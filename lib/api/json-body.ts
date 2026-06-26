import { NextResponse } from "next/server";

export type JsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse<{ error: string }> };

export async function parseJsonBody<T extends object>(
  request: Request,
  defaultBody: T
): Promise<JsonBodyResult<T>> {
  const text = await request.text();

  if (text.trim() === "") {
    return { ok: true, body: defaultBody };
  }

  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Malformed JSON request body" }, { status: 400 }),
    };
  }
}
