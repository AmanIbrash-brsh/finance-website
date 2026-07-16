import { getDb } from './db.js';

// Helper to add months or years to a date string (YYYY-MM-DD)
function advanceDate(dateStr, period) {
  const date = new Date(dateStr);
  if (period === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date.toISOString().slice(0, 10);
}

export async function checkSubscriptions(bot) {
  if (!bot) {
    console.log('Scheduler: Bot is not initialized. Skipping subscription checks.');
    return;
  }

  console.log('🕰️ Running scheduled subscription checks...');
  const db = getDb();
  
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  try {
    // 1. Pre-notification for tomorrow's payments
    const upcomingSubs = await db.all(
      'SELECT * FROM subscriptions WHERE active = 1 AND next_payment_date = ?',
      tomorrowStr
    );

    for (const sub of upcomingSubs) {
      try {
        await bot.telegram.sendMessage(
          sub.user_id,
          `🔔 **Напоминание о подписке!**\n\nЗавтра ожидается оплата подписки *${sub.name}* на сумму *${sub.amount} ₽*.`,
          { parse_mode: 'Markdown' }
        );
        console.log(`Sent upcoming subscription warning to user ${sub.user_id} for sub: ${sub.name}`);
      } catch (err) {
        console.error(`Failed to send Telegram message to user ${sub.user_id}:`, err.message);
      }
    }

    // 2. Process today's payments (Notify + Log Expense + Advance Date)
    const todaySubs = await db.all(
      'SELECT * FROM subscriptions WHERE active = 1 AND next_payment_date <= ?',
      todayStr
    );

    for (const sub of todaySubs) {
      try {
        await db.run('BEGIN TRANSACTION');

        // 1. Log transaction expense
        await db.run(
          'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
          sub.user_id, 'expense', sub.amount, 'Развлечения', `Подписка: ${sub.name}`, todayStr
        );

        // 2. Advance next payment date
        const newPaymentDate = advanceDate(sub.next_payment_date, sub.period);
        await db.run(
          'UPDATE subscriptions SET next_payment_date = ? WHERE id = ?',
          newPaymentDate, sub.id
        );

        await db.run('COMMIT');

        // 3. Notify user in Telegram
        await bot.telegram.sendMessage(
          sub.user_id,
          `📅 **Списание по подписке!**\n\nСегодня оплачена подписка *${sub.name}* на сумму *${sub.amount} ₽*.\n` +
          `💸 Расход автоматически добавлен в историю.\n` +
          `📆 Следующий платеж запланирован на: *${newPaymentDate}*`,
          { parse_mode: 'Markdown' }
        );
        console.log(`Processed subscription payment for sub: ${sub.name}, advanced to: ${newPaymentDate}`);
      } catch (err) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error(`Failed to process payment for subscription ${sub.name} (${sub.id}):`, err);
      }
    }
  } catch (err) {
    console.error('Error checking subscriptions:', err);
  }
}

// Start daily check intervals
export function startScheduler(bot) {
  // Run check immediately on start
  setTimeout(() => checkSubscriptions(bot), 5000);

  // Run checks every 12 hours (12 * 60 * 60 * 1000 ms)
  const intervalMs = 12 * 60 * 60 * 1000;
  setInterval(() => {
    checkSubscriptions(bot);
  }, intervalMs);

  console.log('⏰ Subscription scheduler successfully started (checks every 12 hours).');
}
