import { z } from "zod";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };

/** Throwable error that maps cleanly onto the JSON error envelope. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, status = 200): Response {
  const body: ApiOk<T> = { ok: true, data };
  return Response.json(body, { status });
}

export function jsonErr(code: string, message: string, status: number): Response {
  const body: ApiErr = { ok: false, error: { code, message } };
  return Response.json(body, { status });
}

/** Catch-all for route handlers: `catch (err) { return handleApiError(err); }` */
export function handleApiError(err: unknown): Response {
  if (err instanceof ApiError) return jsonErr(err.code, err.message, err.status);
  console.error(err);
  return jsonErr("internal", "Something went wrong on our end. Please try again.", 500);
}

/**
 * Parse and validate a JSON request body. Returns `{ data }` on success or
 * `{ error }` (a ready-to-return 400 Response) on failure.
 */
export async function parseJson<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonErr("invalid_json", "The request body isn't valid JSON.", 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    const message = path ? `${path}: ${issue.message}` : issue.message;
    return { error: jsonErr("invalid_input", message, 400) };
  }
  return { data: result.data };
}
