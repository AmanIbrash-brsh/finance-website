import { Telegraf, Markup } from 'telegraf';
import { getDb } from './db.js';

let bot;

export async function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || token === 'your_telegram_bot_token_here') {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not configured. Telegram bot will not start.');
    return null;
  }

  bot = new Telegraf(token);

  // /start command
  bot.start(async (ctx) => {
    const name = ctx.from.first_name || 'друг';

    await ctx.reply(
      `Привет, ${name}! 👋\n\n` +
      `Я твой финансовый ассистент. Теперь мы используем веб-приложение для основного учета!\n\n` +
      `Чтобы получать напоминания о подписках и долгах, привяжи этот аккаунт к профилю на сайте.\n` +
      `Зайди в настройки на сайте, сгенерируй код привязки и отправь мне команду:\n\n` +
      `/link <твой-код>`
    );
  });

  // /link command
  bot.command('link', async (ctx) => {
    const text = ctx.message.text.trim();
    const code = text.split(' ')[1];

    if (!code) {
      return ctx.reply('Использование: /link <код>\nНапример: /link A1B2C3D4');
    }

    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE telegram_link_code = ?', code.toUpperCase());

    if (!user) {
      return ctx.reply('❌ Неверный или устаревший код привязки. Проверьте код на сайте.');
    }

    // Link telegram account
    await db.run('UPDATE users SET telegram_id = ?, telegram_link_code = NULL WHERE id = ?', ctx.from.id, user.id);

    await ctx.reply('✅ Аккаунт успешно привязан! Теперь я буду присылать тебе напоминания о важных финансовых событиях.');
  });

  bot.catch((err, ctx) => {
    console.error(`Error in bot for update ${ctx.update.update_id}:`, err);
  });

  bot.launch().then(() => {
    console.log('🤖 Telegram Bot successfully launched!');
  }).catch((err) => {
    console.error('Failed to launch bot:', err);
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}
