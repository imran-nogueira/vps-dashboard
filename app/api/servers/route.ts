import { NextResponse } from "next/server";
import { createServer, createServerSchema, listServersWithLiveData, summarize } from "@/lib/servers";

export const dynamic = "force-dynamic";

export async function GET() {
  const servers = await listServersWithLiveData();
  return NextResponse.json({ servers, summary: summarize(servers) });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const id = createServer(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
