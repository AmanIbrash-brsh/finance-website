import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb } from './db.js';
import { initBot } from './bot.js';
import { startScheduler } from './scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Verification helper for Telegram WebApp initData
function verifyTelegramInitData(initData, botToken) {
  if (!botToken || botToken === 'your_telegram_bot_token_here') {
    return false;
  }
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const pairs = [];
    for (const [key, value] of params.entries()) {
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  } catch (err) {
    console.error('Error verifying Telegram initData:', err);
    return false;
  }
}

// Authentication Middleware
async function authMiddleware(req, res, next) {
  const db = getDb();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  // 1. Check for Telegram Mini App initData
  const initData = req.headers['x-telegram-init-data'];
  if (initData) {
    const isValid = verifyTelegramInitData(initData, botToken);
    
    // In development mode, if bot token is placeholder, let it pass or use mock user
    const isDevPlaceholder = !botToken || botToken === 'your_telegram_bot_token_here';
    
    if (isValid || isDevPlaceholder) {
      try {
        const params = new URLSearchParams(initData);
        const userObjStr = params.get('user');
        if (userObjStr) {
          const tgUser = JSON.parse(userObjStr);
          
          // Ensure user exists in database
          let user = await db.get('SELECT * FROM users WHERE id = ?', tgUser.id);
          if (!user) {
            await db.run(
              'INSERT INTO users (id, username, first_name) VALUES (?, ?, ?)',
              tgUser.id, tgUser.username || null, tgUser.first_name || null
            );
            user = { id: tgUser.id, username: tgUser.username, first_name: tgUser.first_name };
          }
          
          req.user = user;
          return next();
        }
      } catch (err) {
        console.error('Failed to parse user in initData:', err);
      }
    }
  }

  // 2. Check for Token (Bearer token for standard browser access)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const user = await db.get('SELECT * FROM users WHERE auth_token = ?', token);
    
    if (user) {
      req.user = user;
      return next();
    }
  }

  // 3. Fallback for Local Dev testing if no auth headers provided
  if (process.env.NODE_ENV === 'development' || !botToken || botToken === 'your_telegram_bot_token_here') {
    // Return a mock user for local testing
    let user = await db.get('SELECT * FROM users WHERE id = 1');
    if (!user) {
      await db.run(
        'INSERT INTO users (id, username, first_name, auth_token) VALUES (1, "test_user", "Test User", "test_token_123")'
      );
      user = { id: 1, username: 'test_user', first_name: 'Test User', auth_token: 'test_token_123' };
    }
    req.user = user;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

// --- API ENDPOINTS ---

// GET /api/user/profile
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    
    // Get total income & expense
    const totals = await db.get(
      `SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM transactions WHERE user_id = ?`,
      req.user.id
    );

    const balance = (totals?.income || 0) - (totals?.expense || 0);

    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        first_name: req.user.first_name,
        currency: req.user.currency,
        auth_token: req.user.auth_token
      },
      balance,
      totalIncome: totals?.income || 0,
      totalExpense: totals?.expense || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200',
      req.user.id
    );
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
app.post('/api/transactions', authMiddleware, async (req, res) => {
  const { type, amount, category, description, date } = req.body;
  if (!type || !amount || !category || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
      req.user.id, type, parseFloat(amount), category, description || null, date
    );
    
    const newTx = await db.get('SELECT * FROM transactions WHERE id = ?', result.lastID);
    res.status(201).json(newTx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.run(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      req.params.id, req.user.id
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscriptions
app.get('/api/subscriptions', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const subscriptions = await db.all(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_payment_date ASC',
      req.user.id
    );
    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscriptions
app.post('/api/subscriptions', authMiddleware, async (req, res) => {
  const { name, amount, period, next_payment_date } = req.body;
  if (!name || !amount || !next_payment_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO subscriptions (user_id, name, amount, period, next_payment_date, active) VALUES (?, ?, ?, ?, ?, 1)',
      req.user.id, name, parseFloat(amount), period || 'monthly', next_payment_date
    );
    const newSub = await db.get('SELECT * FROM subscriptions WHERE id = ?', result.lastID);
    res.status(201).json(newSub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/subscriptions/:id
app.put('/api/subscriptions/:id', authMiddleware, async (req, res) => {
  const { name, amount, period, next_payment_date, active } = req.body;
  try {
    const db = getDb();
    const currentSub = await db.get('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!currentSub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await db.run(
      `UPDATE subscriptions SET 
        name = ?, 
        amount = ?, 
        period = ?, 
        next_payment_date = ?, 
        active = ? 
       WHERE id = ? AND user_id = ?`,
      name !== undefined ? name : currentSub.name,
      amount !== undefined ? parseFloat(amount) : currentSub.amount,
      period !== undefined ? period : currentSub.period,
      next_payment_date !== undefined ? next_payment_date : currentSub.next_payment_date,
      active !== undefined ? parseInt(active) : currentSub.active,
      req.params.id, req.user.id
    );

    const updatedSub = await db.get('SELECT * FROM subscriptions WHERE id = ?', req.params.id);
    res.json(updatedSub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/subscriptions/:id
app.delete('/api/subscriptions/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.run(
      'DELETE FROM subscriptions WHERE id = ? AND user_id = ?',
      req.params.id, req.user.id
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shopping
app.get('/api/shopping', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const items = await db.all(
      'SELECT * FROM shopping_list WHERE user_id = ? ORDER BY bought ASC, priority DESC, id DESC',
      req.user.id
    );
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shopping
app.post('/api/shopping', authMiddleware, async (req, res) => {
  const { item_name, estimated_price, priority } = req.body;
  if (!item_name) {
    return res.status(400).json({ error: 'Missing item name' });
  }
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO shopping_list (user_id, item_name, estimated_price, priority, bought) VALUES (?, ?, ?, ?, 0)',
      req.user.id, item_name, parseFloat(estimated_price || 0), priority || 'medium'
    );
    const newItem = await db.get('SELECT * FROM shopping_list WHERE id = ?', result.lastID);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shopping/:id/buy
app.post('/api/shopping/:id/buy', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const item = await db.get('SELECT * FROM shopping_list WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.bought === 1) {
      return res.status(400).json({ error: 'Item already bought' });
    }

    // Start database transaction to ensure atomicity
    await db.run('BEGIN TRANSACTION');
    
    // 1. Mark item as bought
    await db.run('UPDATE shopping_list SET bought = 1 WHERE id = ?', req.params.id);

    // 2. Add to transaction log as expense
    const today = new Date().toISOString().slice(0, 10);
    
    // Helper to detect category based on item name
    const detectCategory = (name) => {
      const n = name.toLowerCase();
      if (['хлеб', 'молоко', 'еда', 'сыр', 'масло', 'мясо', 'овощи', 'фрукты'].some(k => n.includes(k))) return 'Еда';
      if (['такси', 'бензин', 'билет', 'проезд'].some(k => k.includes(n))) return 'Транспорт';
      if (['куртка', 'джинсы', 'обувь', 'кроссовки', 'одежда'].some(k => n.includes(k))) return 'Одежда';
      if (['фильм', 'игра', 'кино', 'развлечение'].some(k => n.includes(k))) return 'Развлечения';
      return 'Покупки';
    };

    const category = detectCategory(item.item_name);

    await db.run(
      'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
      req.user.id, 'expense', item.estimated_price, category, `Покупка: ${item.item_name}`, today
    );

    await db.run('COMMIT');

    const updatedItem = await db.get('SELECT * FROM shopping_list WHERE id = ?', req.params.id);
    res.json({ success: true, item: updatedItem });
  } catch (err) {
    try { await db.run('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shopping/:id
app.delete('/api/shopping/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.run(
      'DELETE FROM shopping_list WHERE id = ? AND user_id = ?',
      req.params.id, req.user.id
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files
const frontendDistPath = path.resolve(__dirname, '../dist');
app.use(express.static(frontendDistPath));

// Health check / API status
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Fallback to React SPA index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // In development or if frontend dist is missing, send a helper message
      res.status(404).send('Frontend is not built or index.html is missing. Run frontend build first.');
    }
  });
});

// Start Express server & bot
async function startServer() {
  try {
    await initDb();
    const bot = await initBot();
    if (bot) {
      startScheduler(bot);
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

startServer();
