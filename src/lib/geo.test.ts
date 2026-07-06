import { describe, expect, it } from "vitest";
import { haversineMeters, isWithinGeofence } from "@/lib/geo";

const NYC = { lat: 40.7128, lng: -74.006 };
const LA = { lat: 34.0522, lng: -118.2437 };

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(NYC, NYC)).toBe(0);
  });

  it("measures ~1.11 km per 0.01 degrees of latitude", () => {
    const d = haversineMeters(NYC, { lat: 40.7228, lng: -74.006 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1125);
  });

  it("measures NYC to LA at ~3,936 km", () => {
    const d = haversineMeters(NYC, LA);
    expect(d).toBeGreaterThan(3_925_000);
    expect(d).toBeLessThan(3_950_000);
  });

  it("is symmetric", () => {
    expect(haversineMeters(NYC, LA)).toBeCloseTo(haversineMeters(LA, NYC), 6);
  });
});

describe("isWithinGeofence", () => {
  it("accepts a point ~50 m away with a 150 m radius", () => {
    const near = { lat: 40.71325, lng: -74.006 }; // ~50 m north
    expect(isWithinGeofence(near, NYC, 150)).toBe(true);
  });

  it("rejects a point ~1.1 km away with a 150 m radius", () => {
    expect(isWithinGeofence({ lat: 40.7228, lng: -74.006 }, NYC, 150)).toBe(false);
  });
});
