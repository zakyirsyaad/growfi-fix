import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { GameError } from "@/lib/game/errors";

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const json = await request.json().catch(() => ({}));
  return schema.parse(json);
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleApiError(error: unknown) {
  if (error instanceof GameError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", details: error.flatten() },
      { status: 422 }
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}
