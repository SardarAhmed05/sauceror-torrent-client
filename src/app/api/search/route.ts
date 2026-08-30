import { NextRequest, NextResponse } from 'next/server';
import { searchExtTorrents } from '@/lib/scraper/ext';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 seconds max for Vercel serverless

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const category = searchParams.get('cat') || searchParams.get('category') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const sortBy = (searchParams.get('sort') || undefined) as any;
    const sortOrder = (searchParams.get('order') || 'desc') as any;
    const mirror = searchParams.get('mirror') || undefined;

    if (!query.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter "q" is required',
        items: []
      }, { status: 400 });
    }

    const result = await searchExtTorrents(query, {
      category,
      page,
      sortBy,
      sortOrder,
      mirror
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error during search'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, category, page, sortBy, sortOrder, mirror } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Field "query" is required',
        items: []
      }, { status: 400 });
    }

    const result = await searchExtTorrents(query, {
      category,
      page: page || 1,
      sortBy,
      sortOrder,
      mirror
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error during search'
    }, { status: 500 });
  }
}
