import { NextResponse } from "next/server";
import { getAgentCount, getAgentList } from "@/websocket/server";

export async function GET() {
  const agents = getAgentList();
  return NextResponse.json({ count: getAgentCount(), agents });
}
