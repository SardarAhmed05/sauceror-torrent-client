import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'lanterns';
  const encoded = encodeURIComponent(query);

  const results: Record<string, any> = {};

  // 1. Test apibay via allorigins proxy
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://apibay.org/q.php?q=${encoded}`)}`, { cache: 'no-store' });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    results.allorigins_apibay = {
      status: res.status,
      ok: res.ok,
      itemsCount: Array.isArray(json) ? json.length : 0,
      first: Array.isArray(json) && json.length > 0 ? json[0].name : text.slice(0, 80)
    };
  } catch (e: any) {
    results.allorigins_apibay = { error: e.message };
  }

  // 2. Test apibay via corsproxy.io
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://apibay.org/q.php?q=${encoded}`)}`, { cache: 'no-store' });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    results.corsproxy_apibay = {
      status: res.status,
      ok: res.ok,
      itemsCount: Array.isArray(json) ? json.length : 0,
      first: Array.isArray(json) && json.length > 0 ? json[0].name : text.slice(0, 80)
    };
  } catch (e: any) {
    results.corsproxy_apibay = { error: e.message };
  }

  // 3. Test extto via allorigins proxy
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://extto.com/browse/?q=${encoded}`)}`, { cache: 'no-store' });
    const text = await res.text();
    results.allorigins_extto = {
      status: res.status,
      ok: res.ok,
      hasTable: text.includes('torrent-title-link'),
      snippet: text.slice(0, 100)
    };
  } catch (e: any) {
    results.allorigins_extto = { error: e.message };
  }

  // 4. Test YTS API
  try {
    const res = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encoded}`, { cache: 'no-store' });
    const json = await res.json();
    results.yts = {
      status: res.status,
      movieCount: json.data?.movie_count || 0,
      first: json.data?.movies?.[0]?.title
    };
  } catch (e: any) {
    results.yts = { error: e.message };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    query,
    results
  });
}
