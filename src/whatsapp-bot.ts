import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import { runAgent } from './lib/ai/agent';
import { formatWhatsAppMessage, formatWhatsAppHelp } from './lib/ai/formatters';

async function startWhatsAppBot() {
  console.log('====================================================');
  console.log('⚡ STARTING SAUCEROR WHATSAPP BOT (BAILEYS ENGINE)');
  console.log('====================================================');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  // Handle connection events
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 SCAN THIS QR CODE WITH YOUR WHATSAPP APP:');
      console.log('Open WhatsApp > Linked Devices > Link a Device\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsAppBot();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp Bot Connected Successfully!');
      console.log('🤖 Sauceror is now listening for incoming messages...\n');
    }
  });

  // Save auth state credentials whenever updated
  sock.ev.on('creds.update', saveCreds);

  // Handle incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) return;

      // Extract text content
      const incomingText =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      const cleanText = incomingText.trim();
      if (!cleanText) return;

      console.log(`📩 Received message from ${remoteJid}: "${cleanText}"`);

      // Handle greetings / help
      if (/^(hi|hello|help|start|menu|\?)$/i.test(cleanText)) {
        const helpMsg = formatWhatsAppHelp();
        await sock.sendMessage(remoteJid, { text: helpMsg }, { quoted: msg });
        return;
      }

      // Mark message as read
      await sock.readMessages([msg.key]);

      // Execute AI Agent
      console.log(`🔍 Running Sauceror Agent for: "${cleanText}"...`);
      const agentResult = await runAgent(cleanText, { autoResolveTopMagnet: true });

      const replyText = formatWhatsAppMessage(
        agentResult.refinedQuery || cleanText,
        agentResult.items,
        agentResult.topPick
      );

      // Reply back to user
      await sock.sendMessage(remoteJid, { text: replyText }, { quoted: msg });
      console.log(`✅ Replied with ${agentResult.items.length} releases to ${remoteJid}\n`);
    } catch (err: any) {
      console.error('Error handling incoming WhatsApp message:', err?.message);
    }
  });
}

startWhatsAppBot().catch(console.error);
