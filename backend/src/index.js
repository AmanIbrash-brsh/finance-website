import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb } from './db.js';
import { initBot } from './bot.js';
import { startScheduler } from './scheduler.js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_for_finance_tracker_123!';

app.use(cors());
app.use(express.json());

// Authentication Middleware
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = await db.get('SELECT id, email, first_name, telegram_id, currency FROM users WHERE id = ?', decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

// --- AUTH ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password, first_name } = req.body;
  if (!email || !password || !first_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const db = getDb();
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await db.run(
      'INSERT INTO users (email, password_hash, first_name) VALUES (?, ?, ?)',
      email, password_hash, first_name
    );

    const token = jwt.sign({ userId: result.lastID }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: result.lastID, email, first_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, first_name: user.first_name, telegram_id: user.telegram_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/generate-link-code', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g., A1B2C3D4
    await db.run('UPDATE users SET telegram_link_code = ? WHERE id = ?', code, req.user.id);
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER PROFILE ---
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const totals = await db.get(
      `SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM transactions WHERE user_id = ?`,
      req.user.id
    );

    const balance = (totals?.income || 0) - (totals?.expense || 0);
    res.json({ user: req.user, balance, totalIncome: totals?.income || 0, totalExpense: totals?.expense || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSACTIONS ---
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const transactions = await db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200', req.user.id);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  const { type, amount, category, description, date } = req.body;
  if (!type || !amount || !category || !date) return res.status(400).json({ error: 'Missing required fields' });
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

app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CONSTANT INCOMES (SALARY) ---
app.get('/api/incomes', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const incomes = await db.all('SELECT * FROM constant_incomes WHERE user_id = ? ORDER BY day_of_month ASC', req.user.id);
    res.json(incomes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/incomes', authMiddleware, async (req, res) => {
  const { source_name, amount, day_of_month } = req.body;
  if (!source_name || !amount || !day_of_month) return res.status(400).json({ error: 'Missing fields' });
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO constant_incomes (user_id, source_name, amount, day_of_month) VALUES (?, ?, ?, ?)',
      req.user.id, source_name, parseFloat(amount), parseInt(day_of_month)
    );
    const item = await db.get('SELECT * FROM constant_incomes WHERE id = ?', result.lastID);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/incomes/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.run('DELETE FROM constant_incomes WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DEBTS ---
app.get('/api/debts', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const debts = await db.all('SELECT * FROM debts WHERE user_id = ? ORDER BY status ASC, due_date ASC', req.user.id);
    res.json(debts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debts', authMiddleware, async (req, res) => {
  const { person_name, amount, type, due_date } = req.body;
  if (!person_name || !amount || !type) return res.status(400).json({ error: 'Missing fields' });
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO debts (user_id, person_name, amount, type, due_date) VALUES (?, ?, ?, ?, ?)',
      req.user.id, person_name, parseFloat(amount), type, due_date || null
    );
    const debt = await db.get('SELECT * FROM debts WHERE id = ?', result.lastID);
    res.status(201).json(debt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/debts/:id/pay', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const debt = await db.get('SELECT * FROM debts WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!debt) return res.status(404).json({ error: 'Not found' });
    
    await db.run('BEGIN TRANSACTION');
    await db.run('UPDATE debts SET status = "paid" WHERE id = ?', req.params.id);
    
    // Add transaction
    const today = new Date().toISOString().slice(0, 10);
    const txType = debt.type === 'owe' ? 'expense' : 'income';
    const category = debt.type === 'owe' ? 'Возврат долга' : 'Вернули долг';
    
    await db.run(
      'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
      req.user.id, txType, debt.amount, category, `Долг: ${debt.person_name}`, today
    );
    await db.run('COMMIT');
    
    const updated = await db.get('SELECT * FROM debts WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    const db = getDb();
    try { await db.run('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/debts/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.run('DELETE FROM debts WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SUBSCRIPTIONS ---
app.get('/api/subscriptions', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const subscriptions = await db.all('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_payment_date ASC', req.user.id);
    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscriptions', authMiddleware, async (req, res) => {
  const { name, amount, next_payment_date } = req.body;
  if (!name || !amount || !next_payment_date) return res.status(400).json({ error: 'Missing fields' });
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO subscriptions (user_id, name, amount, period, next_payment_date, active) VALUES (?, ?, ?, "monthly", ?, 1)',
      req.user.id, name, parseFloat(amount), next_payment_date
    );
    const newSub = await db.get('SELECT * FROM subscriptions WHERE id = ?', result.lastID);
    res.status(201).json(newSub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subscriptions/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.run('DELETE FROM subscriptions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../dist');
app.use(express.static(frontendDistPath));

app.get('/api/status', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

async function startServer() {
  try {
    await initDb();
    const bot = await initBot();
    startScheduler(bot);
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

startServer();
