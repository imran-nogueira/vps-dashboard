import { NextResponse } from "next/server";
import {
  deleteServer,
  getServerWithLiveData,
  updateServer,
  updateServerSchema,
} from "@/lib/servers";

export const dynamic = "force-dynamic";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const server = await getServerWithLiveData(id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ server });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = updateServer(id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const server = await getServerWithLiveData(id);
  return NextResponse.json({ server });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const deleted = deleteServer(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
