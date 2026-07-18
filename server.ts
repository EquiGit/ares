import express from 'express';
import path from 'path';
import fs from 'fs';
import { parseEquityMessage } from './src/parser.js';
import { Transaction } from './src/types.js';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Setup directories for database file
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'transactions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed helper
function loadTransactions(): Transaction[] {
  if (!fs.existsSync(DATA_FILE)) {
    const initialTransactions: Transaction[] = [
      {
        id: '1',
        amount: 2500,
        currency: 'KES',
        senderName: 'JOHN DOE',
        senderPhone: '254712345678',
        reference: 'OGE48FSF8S',
        account: '600123',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4 hours ago
        balance: 150000,
        rawMessage: 'EazzyPay: Payment of KES 2,500.00 to Buy Goods Acc 600123 from JOHN DOE Ref: OGE48FSF8S on 2026-07-14 09:15:30. Balance KES 150,000.00.',
        status: 'completed',
        parsedSuccessfully: true,
        type: 'eazzypay'
      },
      {
        id: '2',
        amount: 12000,
        currency: 'KES',
        senderName: 'ALICE WAMBUI',
        senderPhone: '254711223344',
        reference: 'OGE89XSA2S',
        account: '9876543210',
        timestamp: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(), // 3.5 hours ago
        balance: 162000,
        rawMessage: 'EQBK: Mobile Transfer of KES 12,000.00 from ALICE WAMBUI (254711223344) to Acc. 9876543210 on 2026-07-14 09:30:15. Ref: OGE89XSA2S. Balance: KES 162,000.00.',
        status: 'completed',
        parsedSuccessfully: true,
        type: 'mobile_transfer'
      },
      {
        id: '3',
        amount: 450,
        currency: 'KES',
        senderName: 'DAVID OTIENO',
        senderPhone: '254722334455',
        reference: 'OGE12ASD3A',
        account: '9876543210',
        timestamp: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString(), // 2.8 hours ago
        balance: 162450,
        rawMessage: 'Equitel: You have received KES 450.00 from 254722334455 - DAVID OTIENO. Ref: OGE12ASD3A on 2026-07-14 10:05:00. Balance: KES 162,450.00.',
        status: 'completed',
        parsedSuccessfully: true,
        type: 'equitel'
      },
      {
        id: '4',
        amount: 7800,
        currency: 'KES',
        senderName: 'GRACE MUTUA',
        senderPhone: '254733445566',
        reference: 'OGE55TGY7U',
        account: '600123',
        timestamp: new Date(Date.now() - 1.2 * 3600 * 1000).toISOString(), // 1.2 hours ago
        balance: 170250,
        rawMessage: 'EazzyPay: Payment of KES 7,800.00 to Buy Goods Acc 600123 from GRACE MUTUA Ref: OGE55TGY7U on 2026-07-14 10:45:00. Balance KES 170,250.00.',
        status: 'completed',
        parsedSuccessfully: true,
        type: 'eazzypay'
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialTransactions, null, 2));
    return initialTransactions;
  }
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error parsing transactions file', err);
    return [];
  }
}

function saveTransactions(transactions: Transaction[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(transactions, null, 2));
  } catch (err) {
    console.error('Error saving transactions file', err);
  }
}

// Global clients array for SSE
let sseClients: express.Response[] = [];

// Broadcast helper
function broadcastEvent(type: string, data: any) {
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  sseClients.forEach(client => client.write(payload));
}

// Body parsers
app.use(express.json());
app.use(express.text({ type: ['text/plain', 'text/html'] }));

// API: Get transactions
app.get('/api/transactions', (req, res) => {
  const transactions = loadTransactions();
  res.json(transactions);
});

// API: Clear transactions
app.post('/api/transactions/clear', (req, res) => {
  saveTransactions([]);
  broadcastEvent('clear', null);
  res.json({ status: 'ok', message: 'Transactions cleared successfully' });
});

// API: Webhook endpoint for Equity Payment Messages
function isEquityPaymentSMS(message: string): boolean {

    const text = message.toLowerCase();

    const equityPatterns = [

        // New Equity format
        ["confirmed", "phone no", "received via m-pesa", "ref"],

        // EazzyPay
        ["eazzypay", "payment of kes"],

        // Buy Goods
        ["buy goods"],

        // Mobile Transfer
        ["mobile transfer"],

        // Equitel
        ["equitel", "received"]

    ];

    return equityPatterns.some(pattern =>
        pattern.every(word => text.includes(word))
    );

}
app.post('/api/webhooks/equity-payment', (req, res) => {
  let rawBody = '';
  let messageData: any = {};

  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (req.body && typeof req.body === 'object') {
    if (req.body.message) {
      rawBody = req.body.message;
      messageData = { ...req.body };
    } else if (req.body.rawMessage) {
      rawBody = req.body.rawMessage;
      messageData = { ...req.body };
    } else {
      // It might be already parsed JSON directly
      messageData = { ...req.body };
    }
  }

  let transaction: Transaction;

  if (rawBody) {
    if (!isEquityPaymentSMS(rawBody)) {

    console.log("🚫 Ignored SMS");

    console.log(rawBody);

    return res.status(200).json({

        status: "ignored",

        reason: "Not an Equity payment SMS"

    });

}
    // We have a raw message, let's parse it
    const parsed = parseEquityMessage(rawBody);
    transaction = {
      id: Math.random().toString(36).substring(2, 11),
      amount: parsed.amount || messageData.amount || 0,
      currency: parsed.currency || messageData.currency || 'KES',
      senderName: parsed.senderName || messageData.senderName || 'Unknown Customer',
      senderPhone: parsed.senderPhone || messageData.senderPhone,
      reference: parsed.reference || messageData.reference || ('EQ' + Math.random().toString(36).substring(2, 10).toUpperCase()),
      account: parsed.account || messageData.account || 'Primary Account',
      timestamp: parsed.timestamp || messageData.timestamp || new Date().toISOString(),
      balance: parsed.balance || messageData.balance,
      rawMessage: rawBody,
      status: parsed.amount && parsed.reference ? 'completed' : 'failed',
      parsedSuccessfully: parsed.parsedSuccessfully || false,
      type: parsed.type || 'generic',
    };
  } else {
    // Structured JSON webhook
    transaction = {
      id: Math.random().toString(36).substring(2, 11),
      amount: Number(messageData.amount) || 0,
      currency: messageData.currency || 'KES',
      senderName: messageData.senderName || 'Unknown Customer',
      senderPhone: messageData.senderPhone || '',
      reference: (messageData.reference || 'EQ' + Math.random().toString(36).substring(2, 10).toUpperCase()).toUpperCase(),
      account: messageData.account || 'Primary Account',
      timestamp: messageData.timestamp || new Date().toISOString(),
      balance: messageData.balance ? Number(messageData.balance) : undefined,
      rawMessage: messageData.rawMessage || `Structured Webhook: ${messageData.reference || 'No Ref'}`,
      status: messageData.status || (messageData.amount && messageData.reference ? 'completed' : 'failed'),
      parsedSuccessfully: true,
      type: messageData.type || 'generic',
    };
  }

  // Load existing, append, and save
  const transactions = loadTransactions();
  
  // Basic double-payment/duplicate ref protection (idempotency check!)
  const isDuplicate = transactions.some(t => t.reference === transaction.reference);
  if (isDuplicate) {
  return res.status(200).json({
    status: "duplicate",
    message: "Transaction already processed",
    reference: transaction.reference
  });
}

  transactions.unshift(transaction); // Prepend to show on top
  saveTransactions(transactions);

  // Broadcast to all active dashboards
  broadcastEvent('transaction', transaction);

  res.status(201).json({
    status: 'success',
    message: 'Webhook processed successfully',
    transaction,
  });
});

// API: Server-Sent Events stream for real-time dashboard updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  
  // Confirm connection
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    sseClients = sseClients.filter(c => c !== res);
  });
});

async function startServer() {

  if (process.env.NODE_ENV !== 'production') {

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);

  } else {

    const distPath = path.join(process.cwd(), 'dist');

    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ARES Gateway running on port ${PORT}`);
  });

}

startServer();
