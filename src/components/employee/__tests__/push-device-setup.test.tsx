/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToasterProvider } from "@/components/ui/Toaster";
import { PushDeviceSetup } from "@/components/employee/PushDeviceSetup";

const PUBLIC_KEY = "dGVzdC1rZXk";
const ENDPOINT = "https://push.example.com/send/abc";

function renderSetup() {
  return render(
    <ToasterProvider>
      <PushDeviceSetup />
    </ToasterProvider>
  );
}

function stubPushSupport({ permission = "granted", subscribed = false } = {}) {
  const subscription = {
    endpoint: ENDPOINT,
    toJSON: () => ({
      endpoint: ENDPOINT,
      expirationTime: null,
      keys: { p256dh: "p-key", auth: "a-key" },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const registration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(subscribed ? subscription : null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    },
  };
  const serviceWorker = {
    getRegistration: vi.fn().mockResolvedValue(subscribed ? registration : undefined),
    register: vi.fn().mockResolvedValue(registration),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    requestPermission: vi.fn().mockResolvedValue(permission),
  });
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", PUBLIC_KEY);
  return { serviceWorker, registration, subscription };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe("PushDeviceSetup", () => {
  it("shows a muted line when push isn't supported", async () => {
    // jsdom has no navigator.serviceWorker or window.PushManager by default.
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", PUBLIC_KEY);
    renderSetup();
    expect(await screen.findByText("Push isn't available on this device.")).toBeTruthy();
  });

  it("registers the service worker and POSTs the subscription on enable", async () => {
    const { serviceWorker, registration, subscription } = stubPushSupport();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true, data: { registered: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSetup();
    fireEvent.click(await screen.findByRole("button", { name: "Enable push" }));

    expect(await screen.findByText("Push is on for this device.")).toBeTruthy();
    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/me/push-devices");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      subscription: { endpoint: ENDPOINT, keys: { p256dh: "p-key", auth: "a-key" } },
    });
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("shows the blocked message when notification permission is denied", async () => {
    stubPushSupport({ permission: "denied" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderSetup();
    fireEvent.click(await screen.findByRole("button", { name: "Enable push" }));

    expect(
      await screen.findByText("Notifications are blocked in your browser settings.")
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unsubscribes and DELETEs the device on turn off", async () => {
    const { subscription } = stubPushSupport({ subscribed: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, data: { removed: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSetup();
    expect(await screen.findByText("Push is on for this device.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));

    expect(await screen.findByText("Get shift alerts on this device.")).toBeTruthy();
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/me/push-devices");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ endpoint: ENDPOINT });
    expect(screen.queryByText("Push is on for this device.")).toBeNull();
  });

  it("rolls back the browser subscription when the server rejects the registration", async () => {
    const { subscription } = stubPushSupport();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ ok: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSetup();
    fireEvent.click(await screen.findByRole("button", { name: "Enable push" }));

    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Couldn't enable push notifications.")).toBeTruthy();
    expect(screen.queryByText("Push is on for this device.")).toBeNull();
  });

  it("rolls back the browser subscription when the registration fetch rejects", async () => {
    const { subscription } = stubPushSupport();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);

    renderSetup();
    fireEvent.click(await screen.findByRole("button", { name: "Enable push" }));

    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Couldn't enable push notifications.")).toBeTruthy();
    expect(screen.queryByText("Push is on for this device.")).toBeNull();
  });
});
