import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/shared/db'
import { checkHealth } from '@/shared/health'

export async function GET() {
  const status = await checkHealth(async () => {
    await db.execute(sql`select 1`)
  })

  return NextResponse.json(status, { status: status.ok ? 200 : 503 })
}
