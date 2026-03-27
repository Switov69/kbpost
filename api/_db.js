// api/_db.js — общий хелпер для подключения к Neon Postgres
// Используется всеми serverless functions

const { neon } = require('@neondatabase/serverless');

let _sql = null;

function getDB() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL не задан в переменных окружения Vercel');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

module.exports = { getDB };
