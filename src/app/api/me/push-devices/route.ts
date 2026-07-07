import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk, parseJson } from "@/lib/api";

const postSchema = z.object({
  subscription: z.object({
    endpoint: z.url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

const deleteSchema = z.object({
  endpoint: z.url(),
});

// PushDevice.token is JSON.stringify({ endpoint, keys }). Matching on the
// serialized `"endpoint":"…"` pair (not a bare substring) means only rows for
// exactly this endpoint match — a crafted prefix like the shared FCM host
// can't sweep up other users' subscriptions.
function endpointFragment(endpoint: string): string {
  return `"endpoint":${JSON.stringify(endpoint)}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const parsed = await parseJson(request, postSchema);
  if (parsed.error) return parsed.error;

  const { subscription } = parsed.data;
  const token = JSON.stringify({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  });

  // Endpoints are unique per browser+origin, but a shared device may have
  // registered this endpoint under a previous user (or with rotated keys) —
  // remove existing rows for exactly this endpoint before creating the new one.
  await prisma.pushDevice.deleteMany({
    where: { token: { contains: endpointFragment(subscription.endpoint) } },
  });
  await prisma.pushDevice.create({
    data: { userId: session.user.id, token, platform: "web" },
  });

  return jsonOk({ registered: true }, 201);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const parsed = await parseJson(request, deleteSchema);
  if (parsed.error) return parsed.error;

  await prisma.pushDevice.deleteMany({
    where: { userId: session.user.id, token: { contains: endpointFragment(parsed.data.endpoint) } },
  });

  return jsonOk({ removed: true });
}
