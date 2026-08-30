import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'lanterns';
  const encoded = encodeURIComponent(query);

  const results: Record<string, any> = {};

  // 1. Test extto.com
  try {
    const res = await fetch(`https://extto.com/browse/?q=${encoded}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    results.extto = { status: res.status, ok: res.ok };
  } catch (e: any) {
    results.extto = { error: e.message };
  }

  // 2. Test apibay.org
  try {
    const res = await fetch(`https://apibay.org/q.php?q=${encoded}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    results.apibay = {
      status: res.status,
      ok: res.ok,
      itemsCount: Array.isArray(json) ? json.length : 0,
      rawFirst: Array.isArray(json) && json.length > 0 ? json[0].name : text.slice(0, 100)
    };
  } catch (e: any) {
    results.apibay = { error: e.message };
  }

  // 3. Test solidtorrents.to
  try {
    const res = await fetch(`https://solidtorrents.to/api/v1/search?q=${encoded}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    results.solidtorrents = {
      status: res.status,
      ok: res.ok,
      itemsCount: json?.results?.length || 0
    };
  } catch (e: any) {
    results.solidtorrents = { error: e.message };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    query,
    results
  });
}
