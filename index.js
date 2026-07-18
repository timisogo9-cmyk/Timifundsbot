// Timifundsbot - Telegram bot for tracking funds/expenses
// Built with Telegraf: https://telegraf.js.org

require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN is missing. Set it in your .env file or Railway variables.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ---------- Simple JSON file storage ----------
// NOTE: Railway's filesystem is ephemeral - this resets on redeploy/restart.
// For persistent data, upgrade to Postgres (see README).
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read data file:', err);
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUserRecord(data, userId) {
  if (!data[userId]) {
    data[userId] = { balance: 0, transactions: [] };
  }
  return data[userId];
}

// ---------- Bot commands ----------

bot.start((ctx) => {
  ctx.reply(
    `Welcome to Timifundsbot!\n\n` +
    `Commands:\n` +
    `/add <amount> <description> - Add funds (e.g. /add 5000 salary)\n` +
    `/spend <amount> <description> - Log an expense (e.g. /spend 1200 groceries)\n` +
    `/balance - Check your current balance\n` +
    `/history - View recent transactions\n` +
    `/reset - Clear your data\n`
  );
});

bot.command('add', (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  const amount = parseFloat(parts[0]);
  const description = parts.slice(1).join(' ') || 'No description';

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Usage: /add <amount> <description>\nExample: /add 5000 salary');
  }

  const data = loadData();
  const userId = ctx.from.id;
  const record = getUserRecord(data, userId);

  record.balance += amount;
  record.transactions.push({
    type: 'credit',
    amount,
    description,
    date: new Date().toISOString(),
  });

  saveData(data);
  ctx.reply(`Added ${amount} (${description}).\nNew balance: ${record.balance}`);
});

bot.command('spend', (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  const amount = parseFloat(parts[0]);
  const description = parts.slice(1).join(' ') || 'No description';

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Usage: /spend <amount> <description>\nExample: /spend 1200 groceries');
  }

  const data = loadData();
  const userId = ctx.from.id;
  const record = getUserRecord(data, userId);

  record.balance -= amount;
  record.transactions.push({
    type: 'debit',
    amount,
    description,
    date: new Date().toISOString(),
  });

  saveData(data);
  ctx.reply(`Spent ${amount} (${description}).\nNew balance: ${record.balance}`);
});

bot.command('balance', (ctx) => {
  const data = loadData();
  const userId = ctx.from.id;
  const record = getUserRecord(data, userId);
  ctx.reply(`Your current balance: ${record.balance}`);
});

bot.command('history', (ctx) => {
  const data = loadData();
  const userId = ctx.from.id;
  const record = getUserRecord(data, userId);

  if (record.transactions.length === 0) {
    return ctx.reply('No transactions yet.');
  }

  const last10 = record.transactions.slice(-10).reverse();
  const lines = last10.map((t) => {
    const sign = t.type === 'credit' ? '+' : '-';
    const dateStr = new Date(t.date).toLocaleString();
    return `${sign}${t.amount} - ${t.description} (${dateStr})`;
  });

  ctx.reply(`Last ${last10.length} transactions:\n\n${lines.join('\n')}`);
});

bot.command('reset', (ctx) => {
  const data = loadData();
  const userId = ctx.from.id;
  data[userId] = { balance: 0, transactions: [] };
  saveData(data);
  ctx.reply('Your data has been reset.');
});

// ---------- Error handling ----------
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// ---------- Launch ----------
bot.launch();
console.log('Timifundsbot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
