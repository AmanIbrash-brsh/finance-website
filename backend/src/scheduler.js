import { getDb } from './db.js';

let botInstance = null;

export function startScheduler(bot) {
  botInstance = bot;
  // Run checks every hour
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(runChecks, ONE_HOUR);
  
  // Run immediately on start
  runChecks();
  console.log('⏰ Scheduler started (checks every hour).');
}

async function runChecks() {
  console.log('🕰️ Running scheduled checks...');
  try {
    await checkSalaries();
    await checkSubscriptions();
    await checkDebts();
  } catch (err) {
    console.error('Error during scheduled checks:', err);
  }
}

async function checkSalaries() {
  const db = getDb();
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
  const fullDateStr = today.toISOString().slice(0, 10);

  const incomes = await db.all('SELECT * FROM constant_incomes');
  
  for (const income of incomes) {
    // If today is the payout day or later, and it hasn't been credited this month
    if (currentDay >= income.day_of_month && income.last_credited_month !== currentMonthStr) {
      // 1. Add transaction
      await db.run(
        'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
        income.user_id, 'income', income.amount, 'Регулярный доход', income.source_name, fullDateStr
      );

      // 2. Update last credited month
      await db.run(
        'UPDATE constant_incomes SET last_credited_month = ? WHERE id = ?',
        currentMonthStr, income.id
      );

      // 3. Notify user if telegram linked
      const user = await db.get('SELECT telegram_id FROM users WHERE id = ?', income.user_id);
      if (user && user.telegram_id && botInstance) {
        try {
          await botInstance.telegram.sendMessage(
            user.telegram_id,
            `💰 Начислен регулярный доход!\n*${income.source_name}*: +${income.amount} ₽`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.error(`Failed to send salary notification to ${user.telegram_id}`);
        }
      }
    }
  }
}

async function checkSubscriptions() {
  const db = getDb();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const subs = await db.all('SELECT * FROM subscriptions WHERE active = 1 AND next_payment_date = ?', tomorrowStr);

  for (const sub of subs) {
    const user = await db.get('SELECT telegram_id FROM users WHERE id = ?', sub.user_id);
    if (user && user.telegram_id && botInstance) {
      try {
        await botInstance.telegram.sendMessage(
          user.telegram_id,
          `⚠️ Напоминание: Завтра (${tomorrowStr}) будет списание за подписку *${sub.name}* на сумму ${sub.amount} ₽.`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.error(`Failed to send subscription notification to ${user.telegram_id}`);
      }
    }
  }
}

async function checkDebts() {
  const db = getDb();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const debts = await db.all('SELECT * FROM debts WHERE status = "pending" AND due_date = ?', tomorrowStr);

  for (const debt of debts) {
    const user = await db.get('SELECT telegram_id FROM users WHERE id = ?', debt.user_id);
    if (user && user.telegram_id && botInstance) {
      const typeText = debt.type === 'owe' ? 'Вам нужно вернуть долг' : 'Вам должны вернуть долг';
      try {
        await botInstance.telegram.sendMessage(
          user.telegram_id,
          `📅 Напоминание о долге: Завтра крайний срок!\n${typeText}\n*Человек*: ${debt.person_name}\n*Сумма*: ${debt.amount} ₽`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.error(`Failed to send debt notification to ${user.telegram_id}`);
      }
    }
  }
}
