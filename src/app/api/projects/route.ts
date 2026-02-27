import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';

export async function GET() {
  try {
    const db = await getDb();
    const projects = await db.select().from(schema.projects).orderBy(schema.projects.createdAt);
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}
