// api/_db.js — подключение к Neon Postgres
// Используется всеми serverless functions

const { neon } = require('@neondatabase/serverless');

let _sql = null;

function getDB() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      console.error('Критическая ошибка: DATABASE_URL не настроен в Vercel');
      throw new Error('DATABASE_URL не настроен. Добавьте переменную окружения DATABASE_URL в настройках Vercel.');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

module.exports = { getDB };
