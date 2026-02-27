import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';

export async function GET() {
  try {
    const db = await getDb();
    const tasks = await db.select().from(schema.tasks).orderBy(schema.tasks.order);
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
