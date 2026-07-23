import { TelegramBot } from 'node-telegram-bot-api';

const token = '8434157336:AAHH9YoOvcJuG_PQR2h5RDKmri_nN9MezFc';
const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  try {
    if (msg.text === '/start') {
      const keyboard = [
        [
          { text: 'Add Expense', callback_data: 'add_expense' }
        ]
      ];
      const replyMarkup = { reply_markup: { inline_keyboard: keyboard } };
      bot.sendMessage(msg.chat.id, 'Welcome to the finance bot!', replyMarkup);
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(msg.chat.id, 'An error occurred. Please try again later.');
  }
});

bot.on('callback_query', (callbackQuery) => {
  try {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (data === 'add_expense') {
      try {
        bot.sendMessage(chatId, 'Please enter the expense amount and description:');
      } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'An error occurred. Please try again later.');
      }
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(callbackQuery.message.chat.id, 'An error occurred. Please try again later.');
  }
});

bot.on('error', (error) => {
  console.error(error);
});

bot.on('polling_error', (error) => {
  console.error(error);
});