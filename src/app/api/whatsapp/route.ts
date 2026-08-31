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

/**
 * GET Handler: Meta WhatsApp Cloud API Webhook Verification
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
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
      return NextResponse.json({ success: false, error: 'No message content provided' }, { status: 400 });
    }

    const cleanInput = incomingText.trim();
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
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!accessToken || !phoneNumberId) {
        console.error('WhatsApp Bot missing credentials! WHATSAPP_ACCESS_TOKEN set:', !!accessToken, 'WHATSAPP_PHONE_NUMBER_ID set:', !!phoneNumberId);
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
          if (!metaRes.ok) {
            console.error('Meta Graph API Send Error:', metaRes.status, JSON.stringify(metaData));
          } else {
            console.log('WhatsApp message sent successfully to', cleanTo, 'Message ID:', metaData.messages?.[0]?.id);
          }
        } catch (metaErr: any) {
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
