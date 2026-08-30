import { NextRequest, NextResponse } from 'next/server';
import { resolveMagnetLink } from '@/lib/scraper/ext';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, detailUrl, mirror } = body;

    if (!id && !detailUrl) {
      return NextResponse.json({
        success: false,
        error: 'Either "id" or "detailUrl" is required'
      }, { status: 400 });
    }

    const result = await resolveMagnetLink(id || '0', detailUrl || '', mirror);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error resolving magnet'
    }, { status: 500 });
  }
}
