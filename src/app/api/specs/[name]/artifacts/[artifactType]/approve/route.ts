import { NextResponse } from 'next/server';
import { approveArtifact } from '@/lib/specs';
import { broadcastUpdate } from '@/mcp/websocket';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string; artifactType: string }> },
) {
  try {
    const { name, artifactType } = await params;
    const body = await request.json();
    const approvedBy = body.approvedBy || 'human';

    await approveArtifact(name, artifactType, approvedBy);
    broadcastUpdate({ type: 'artifact_approved', specName: name, artifactType });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve artifact' },
      { status: 422 },
    );
  }
}
