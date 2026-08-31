import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/ai/agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 45; // 45 seconds for complete agent run

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, apiKey, mirror, autoResolve } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Field "message" is required'
      }, { status: 400 });
    }

    const agentResult = await runAgent(message, {
      apiKeyOverride: apiKey,
      mirrorOverride: mirror,
      autoResolveTopMagnet: autoResolve !== false
    });

    return NextResponse.json({
      success: true,
      version: '1.4.6',
      data: agentResult
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error executing AI agent'
    }, { status: 500 });
  }
}
