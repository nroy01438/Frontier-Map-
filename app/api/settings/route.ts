import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    displayName: user.displayName,
    expeditionsPaused: user.expeditionsPaused,
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (typeof body?.expeditionsPaused !== "boolean") {
    return NextResponse.json({ error: "expeditionsPaused (boolean) is required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { expeditionsPaused: body.expeditionsPaused },
  });

  return NextResponse.json({ expeditionsPaused: updated.expeditionsPaused });
}
