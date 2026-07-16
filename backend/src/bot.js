import { Telegraf, Markup } from 'telegraf';
import { getDb } from './db.js';
import crypto from 'crypto';

let bot;

// Helper to generate a secure random token
function generateAuthToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Simple category auto-detection based on keywords
function detectCategory(description) {
  const desc = description.toLowerCase();
  
  const foodKeywords = ['еда', 'обед', 'ужин', 'завтрак', 'кафе', 'ресторан', 'продукт', 'супермаркет', 'хлеб', 'молоко', 'мясо', 'пицца', 'кофе', 'чай', 'мак'];
  const transportKeywords = ['такси', 'метро', 'автобус', 'самолет', 'поезд', 'бензин', 'заправка', 'билет', 'шеринг', 'самокат'];
  const entertainmentKeywords = ['кино', 'театр', 'игра', 'steam', 'playstation', 'книга', 'музей', 'концерт', 'бар', 'клуб', 'подписка', 'netflix', 'youtube', 'музыка'];
  const housingKeywords = ['аренда', 'квартира', 'жкх', 'коммуналка', 'свет', 'вода', 'интернет', 'отопление'];
  const clothesKeywords = ['одежда', 'обувь', 'куртка', 'кроссовки', 'футболка', 'штаны', 'носки'];
  const healthKeywords = ['аптека', 'лекарство', 'врач', 'больница', 'анализы', 'витамины', 'стоматолог'];
  const hygieneKeywords = ['мыло', 'шампунь', 'зубная', 'порошок', 'косметика', 'стрижка', 'парикмахер'];

  if (foodKeywords.some(kw => desc.includes(kw))) return 'Еда';
  if (transportKeywords.some(kw => desc.includes(kw))) return 'Транспорт';
  if (entertainmentKeywords.some(kw => desc.includes(kw))) return 'Развлечения';
  if (housingKeywords.some(kw => desc.includes(kw))) return 'Жилье';
  if (clothesKeywords.some(kw => desc.includes(kw))) return 'Одежда';
  if (healthKeywords.some(kw => desc.includes(kw))) return 'Здоровье';
  if (hygieneKeywords.some(kw => desc.includes(kw))) return 'Гигиена';
  
  return 'Прочее';
}

export async function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!token || token === 'your_telegram_bot_token_here') {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not configured. Telegram bot will not start.');
    return null;
  }

  bot = new Telegraf(token);
  const db = getDb();

  // Middleware to register/update user in the database
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const { id, username, first_name } = ctx.from;
      const user = await db.get('SELECT * FROM users WHERE id = ?', id);
      
      if (!user) {
        const token = generateAuthToken();
        await db.run(
          'INSERT INTO users (id, username, first_name, auth_token) VALUES (?, ?, ?, ?)',
          id, username || null, first_name || null, token
        );
        console.log(`Registered new user: ${first_name} (${id})`);
      } else {
        // Update profile information if changed
        await db.run(
          'UPDATE users SET username = ?, first_name = ? WHERE id = ?',
          username || null, first_name || null, id
        );
      }
    }
    return next();
  });

  // /start command - Welcomes user and offers web app
  bot.start(async (ctx) => {
    const webAppLink = `${frontendUrl}`;
    const name = ctx.from.first_name || 'друг';

    await ctx.reply(
      `Привет, ${name}! 👋\n\nЯ помогу тебе вести учет финансов.\n\n` +
      `✍️ **Как добавлять расходы и доходы:**\n` +
      `• Чтобы добавить расход: просто напиши сумму и описание. Например: \`350 кофе и булочка\`\n` +
      `• Чтобы добавить доход: напиши плюс (+), затем сумму и описание. Например: \`+ 45000 Аванс\`\n\n` +
      `🛒 **Список покупок:**\n` +
      `• Добавить: \`/buy [название] [цена]\`. Например: \`/buy Молоко 90\`\n\n` +
      `📅 **Подписки:**\n` +
      `• Добавить: \`/sub [название] [цена]\`. Например: \`/sub Netflix 800\`\n\n` +
      `📊 **Аналитика:**\n` +
      `• Используй команду /stats для быстрой сводки расходов.\n` +
      `• Или открой полноценный Dashboard с графиками по кнопке ниже! 👇`,
      Markup.keyboard([
        [Markup.button.webApp('📊 Открыть Dashboard', webAppLink)]
      ]).resize()
    );
  });

  // /login command - Generates temporary link for desktop/other browser login
  bot.command('login', async (ctx) => {
    const db = getDb();
    const user = await db.get('SELECT auth_token FROM users WHERE id = ?', ctx.from.id);
    let token = user?.auth_token;
    
    if (!token) {
      token = generateAuthToken();
      await db.run('UPDATE users SET auth_token = ? WHERE id = ?', token, ctx.from.id);
    }

    const loginUrl = `${frontendUrl}?token=${token}`;
    await ctx.reply(
      `Вот твоя ссылка для входа в панель управления через обычный браузер (например, на ПК):\n\n` +
      `🔗 ${loginUrl}\n\n` +
      `⚠️ Не передавай эту ссылку никому, она дает доступ к твоим финансам!`,
      { disable_web_page_preview: true }
    );
  });

  // /stats command - Show summary of expenses for current month
  bot.command('stats', async (ctx) => {
    const db = getDb();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Get total expenses
    const totalExp = await db.get(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND type = 'expense' AND date LIKE ?`,
      ctx.from.id, `${currentMonth}%`
    );

    // Get total incomes
    const totalInc = await db.get(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND type = 'income' AND date LIKE ?`,
      ctx.from.id, `${currentMonth}%`
    );

    // Get expenses by category
    const categories = await db.all(
      `SELECT category, SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND type = 'expense' AND date LIKE ?
       GROUP BY category ORDER BY total DESC`,
      ctx.from.id, `${currentMonth}%`
    );

    const expenseSum = totalExp?.total || 0;
    const incomeSum = totalInc?.total || 0;

    let message = `📊 **Статистика за текущий месяц (${currentMonth}):**\n\n`;
    message += `💰 Доходы: *${incomeSum.toFixed(2)} ₽*\n`;
    message += `💸 Расходы: *${expenseSum.toFixed(2)} ₽*\n`;
    message += `📈 Баланс: *${(incomeSum - expenseSum).toFixed(2)} ₽*\n\n`;

    if (categories.length > 0) {
      message += `🔍 **Расходы по категориям:**\n`;
      categories.forEach(cat => {
        const percentage = expenseSum > 0 ? ((cat.total / expenseSum) * 100).toFixed(0) : 0;
        message += `• ${cat.category}: *${cat.total.toFixed(2)} ₽* (${percentage}%)\n`;
      });
    } else {
      message += `Нет расходов в этом месяце.`;
    }

    await ctx.replyWithMarkdownV2(
      message.replace(/\./g, '\\.').replace(/-/g, '\\-').replace(/\+/g, '\\+')
    );
  });

  // /buy command - Adds item to shopping list
  bot.command('buy', async (ctx) => {
    const text = ctx.message.text.replace('/buy', '').trim();
    if (!text) {
      return ctx.reply('Использование: /buy [название] [примерная цена]\nПример: /buy Молоко 90');
    }

    // Regex to split item name and price
    const match = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
    let itemName = text;
    let price = 0;

    if (match) {
      itemName = match[1].trim();
      price = parseFloat(match[2]);
    }

    const db = getDb();
    await db.run(
      'INSERT INTO shopping_list (user_id, item_name, estimated_price, priority) VALUES (?, ?, ?, ?)',
      ctx.from.id, itemName, price, 'medium'
    );

    await ctx.reply(`🛒 Добавлено в список покупок: *${itemName}* (~${price} ₽)`, { parse_mode: 'Markdown' });
  });

  // /sub command - Adds subscription
  bot.command('sub', async (ctx) => {
    const text = ctx.message.text.replace('/sub', '').trim();
    if (!text) {
      return ctx.reply('Использование: /sub [название] [стоимость]\nПример: /sub Netflix 800');
    }

    const match = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
    if (!match) {
      return ctx.reply('Пожалуйста, укажите название подписки и стоимость. Пример: /sub Netflix 800');
    }

    const name = match[1].trim();
    const price = parseFloat(match[2]);
    
    // Set next payment date to 1 month from now
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);
    const nextPaymentStr = nextPayment.toISOString().slice(0, 10);

    const db = getDb();
    await db.run(
      'INSERT INTO subscriptions (user_id, name, amount, period, next_payment_date, active) VALUES (?, ?, ?, ?, ?, 1)',
      ctx.from.id, name, price, 'monthly', nextPaymentStr
    );

    await ctx.reply(
      `📅 Добавлена подписка: *${name}*\n` +
      `💳 Стоимость: *${price} ₽ / мес*\n` +
      `📆 След. платеж: *${nextPaymentStr}*`,
      { parse_mode: 'Markdown' }
    );
  });

  // Text message handler for quick income/expense input
  bot.on('message', async (ctx) => {
    if (!ctx.message.text) return;

    const text = ctx.message.text.trim();
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Check for Income (starts with '+' or '+ ')
    const incomeMatch = text.match(/^\+\s*(\d+(?:\.\d+)?)\s+(.+)$/);
    if (incomeMatch) {
      const amount = parseFloat(incomeMatch[1]);
      const description = incomeMatch[2].trim();
      const category = 'Доходы';

      await db.run(
        'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
        ctx.from.id, 'income', amount, category, description, today
      );

      return ctx.reply(`💰 Добавлен доход: *${amount} ₽* (${description})`, { parse_mode: 'Markdown' });
    }

    // 2. Check for Expense (number followed by description)
    const expenseMatch = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (expenseMatch) {
      const amount = parseFloat(expenseMatch[1]);
      const description = expenseMatch[2].trim();
      const category = detectCategory(description);

      await db.run(
        'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
        ctx.from.id, 'expense', amount, category, description, today
      );

      return ctx.reply(
        `💸 Добавлен расход: *${amount} ₽*\n` +
        `📂 Категория: *${category}*\n` +
        `📝 Описание: *${description}*`,
        { parse_mode: 'Markdown' }
      );
    }

    // If text doesn't match, reply with instructions
    await ctx.reply(
      `Не понял формат сообщения. 🧐\n\n` +
      `• Чтобы записать расход, введи: \`[сумма] [описание]\` (например, \`200 такси\`)\n` +
      `• Чтобы записать доход, введи: \`+ [сумма] [описание]\` (например, \`+ 1500 продажа книг\`)`
    );
  });

  bot.catch((err, ctx) => {
    console.error(`Error in bot for update ${ctx.update.update_id}:`, err);
  });

  bot.launch().then(() => {
    console.log('🤖 Telegram Bot successfully launched!');
  }).catch((err) => {
    console.error('Failed to launch bot:', err);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}
