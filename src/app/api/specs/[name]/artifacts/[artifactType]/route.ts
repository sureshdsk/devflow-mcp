import { NextResponse } from 'next/server';
import { getArtifact, writeArtifact, getSpecStatus, getArtifactTemplate } from '@/lib/specs';
import { broadcastUpdate } from '@/mcp/websocket';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string; artifactType: string }> },
) {
  try {
    const { name, artifactType } = await params;
    const { searchParams } = new URL(request.url);

    if (searchParams.get('template') === 'true') {
      const template = await getArtifactTemplate(name, artifactType);
      return NextResponse.json({ template });
    }

    const content = await getArtifact(name, artifactType);
    if (content === null) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get artifact' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string; artifactType: string }> },
) {
  try {
    const { name, artifactType } = await params;

    // Check blocker gate
    const statuses = await getSpecStatus(name);
    const status = statuses.find((s) => s.id === artifactType);
    if (status?.state === 'blocked') {
      return NextResponse.json(
        { error: `Cannot write "${artifactType}": required artifacts not yet approved` },
        { status: 422 },
      );
    }

    const body = await request.json();
    await writeArtifact(name, artifactType, body.content);
    broadcastUpdate({ type: 'artifact_updated', specName: name, artifactType });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to write artifact' },
      { status: 500 },
    );
  }
}
