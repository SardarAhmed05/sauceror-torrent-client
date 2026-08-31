import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/ai/agent';
import { formatWhatsAppMessage, formatWhatsAppHelp } from '@/lib/ai/formatters';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/**
 * Escape XML for Twilio TwiML responses
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

interface WebhookLog {
  timestamp: string;
  type: string;
  from?: string;
  query?: string;
  payload?: any;
  error?: string;
  metaStatus?: number;
  metaResponse?: any;
}

const recentWebhookLogs: WebhookLog[] = [];

function addLog(log: WebhookLog) {
  recentWebhookLogs.unshift(log);
  if (recentWebhookLogs.length > 20) recentWebhookLogs.pop();
}

/**
 * GET Handler: Meta WhatsApp Cloud API Webhook Verification
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // Live logs viewer
  if (searchParams.get('logs') === '1') {
    return NextResponse.json({
      status: 'webhook_logs',
      totalReceived: recentWebhookLogs.length,
      logs: recentWebhookLogs
    });
  }

  // Diagnostic health checker for environment variables
  if (searchParams.get('debug') === '1') {
    const rawToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    const token = rawToken.trim().replace(/^["']|["']$/g, '');
    return NextResponse.json({
      status: 'diagnostic',
      hasAccessToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? `${token.slice(0, 8)}...${token.slice(-4)}` : 'MISSING',
      hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'AUTO_FROM_PAYLOAD',
      hasVerifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN
    });
  }

  // Direct live test message sender to test Meta Graph API connectivity
  if (searchParams.get('test_send')) {
    const rawTo = searchParams.get('test_send')!;
    const cleanTo = rawTo.replace(/\D/g, '');
    const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim().replace(/^["']|["']$/g, '');
    const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '1330728216782410').trim().replace(/^["']|["']$/g, '');

    try {
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: { body: '🎬 *Test Message from Sauceror AI Agent*\n\nYour Meta WhatsApp Cloud API is connected and working! 🚀\n\nTry sending me: *Interstellar 1080p under 2 gbs*' }
        })
      });

      const metaData = await metaRes.json();
      return NextResponse.json({
        httpStatus: metaRes.status,
        ok: metaRes.ok,
        to: cleanTo,
        phoneIdUsed: phoneId,
        metaResponse: metaData
      });
    } catch (err: any) {
      return NextResponse.json({
        status: 'error',
        error: err.message
      }, { status: 500 });
    }
  }

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'sauceror_verify_token';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WhatsApp Webhook verified successfully!');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return NextResponse.json({
    status: 'error',
    message: 'Verification failed. Invalid verify token.'
  }, { status: 403 });
}

/**
 * POST Handler: Incoming WhatsApp Messages (Meta Cloud API, Twilio, or Test Simulator)
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let incomingText = '';
    let fromNumber = '';
    let isTwilio = false;
    let isMeta = false;
    let metaPhoneNumberId = '';

    // Check if form-urlencoded (Twilio)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      incomingText = formData.get('Body')?.toString() || '';
      fromNumber = formData.get('From')?.toString() || '';
      isTwilio = true;
    } else {
      // JSON Payload (Meta Cloud API or Test Simulator)
      const body = await req.json();

      // Check for Test Simulator payload
      if (body.testMessage) {
        incomingText = body.testMessage;
        fromNumber = body.from || 'tester';
      }
      // Check for Meta Cloud API format
      else if (body.entry && body.entry[0]?.changes && body.entry[0]?.changes[0]?.value) {
        const changeValue = body.entry[0].changes[0].value;
        metaPhoneNumberId = changeValue.metadata?.phone_number_id || '';
        const messages = changeValue.messages;

        // If it's a delivery status update instead of an incoming message
        if (!messages || messages.length === 0) {
          return NextResponse.json({ status: 'ok', type: 'status_update' });
        }

        const msg = messages[0];
        fromNumber = msg.from;

        if (msg.type === 'text') {
          incomingText = msg.text?.body || '';
        } else if (msg.type === 'interactive') {
          incomingText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
        } else {
          incomingText = 'help';
        }
        isMeta = true;
      }
    }

    if (!incomingText.trim()) {
      addLog({ timestamp: new Date().toISOString(), type: 'EMPTY_PAYLOAD' });
      return NextResponse.json({ success: false, error: 'No message content provided' }, { status: 400 });
    }

    const cleanInput = incomingText.trim();
    addLog({ timestamp: new Date().toISOString(), type: 'INCOMING_MSG', from: fromNumber, query: cleanInput });

    let replyText = '';
    let agentResult: any = null;

    // Check for help/welcome commands
    if (/^(hi|hello|help|start|menu|\?)$/i.test(cleanInput)) {
      replyText = formatWhatsAppHelp();
    } else {
      // Execute the AI Agent to scrape ext.to and resolve magnet link
      agentResult = await runAgent(cleanInput, {
        autoResolveTopMagnet: true
      });

      replyText = formatWhatsAppMessage(
        agentResult.refinedQuery || cleanInput,
        agentResult.items,
        agentResult.topPick
      );
    }

    // 1. If request came from Twilio, return TwiML
    if (isTwilio) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${escapeXml(replyText)}</Message>
</Response>`;
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    }

    // 2. If request came from Meta Cloud API, send reply via Graph API
    if (isMeta) {
      const rawToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
      const accessToken = rawToken.trim().replace(/^["']|["']$/g, '');
      const rawPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || metaPhoneNumberId || '1330728216782410';
      const phoneNumberId = rawPhoneId.trim().replace(/^["']|["']$/g, '');

      if (!accessToken) {
        addLog({ timestamp: new Date().toISOString(), type: 'CONFIG_ERROR', error: 'WHATSAPP_ACCESS_TOKEN is missing' });
        console.error('WhatsApp Bot Error: WHATSAPP_ACCESS_TOKEN is not configured in environment variables!');
      } else if (!phoneNumberId) {
        addLog({ timestamp: new Date().toISOString(), type: 'CONFIG_ERROR', error: 'WHATSAPP_PHONE_NUMBER_ID is missing' });
        console.error('WhatsApp Bot Error: WHATSAPP_PHONE_NUMBER_ID could not be determined!');
      } else if (fromNumber) {
        const cleanTo = fromNumber.replace(/\D/g, '');
        try {
          const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanTo,
              type: 'text',
              text: { body: replyText }
            })
          });

          const metaData = await metaRes.json();
          addLog({
            timestamp: new Date().toISOString(),
            type: metaRes.ok ? 'REPLY_SUCCESS' : 'REPLY_ERROR',
            from: cleanTo,
            query: cleanInput,
            metaStatus: metaRes.status,
            metaResponse: metaData
          });

          if (!metaRes.ok) {
            console.error('Meta Graph API Send Error:', metaRes.status, JSON.stringify(metaData));
          } else {
            console.log('WhatsApp message sent successfully to', cleanTo, 'Message ID:', metaData.messages?.[0]?.id);
          }
        } catch (metaErr: any) {
          addLog({ timestamp: new Date().toISOString(), type: 'FETCH_ERROR', error: metaErr?.message });
          console.error('Failed to send Meta Cloud API message:', metaErr?.message);
        }
      }

      return NextResponse.json({
        status: 'ok',
        reply: replyText
      });
    }

    // 3. Return JSON for test simulator or direct API caller
    return NextResponse.json({
      success: true,
      message: replyText,
      data: agentResult
    });
  } catch (err: any) {
    console.error('WhatsApp Webhook error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error processing WhatsApp webhook'
    }, { status: 500 });
  }
}
