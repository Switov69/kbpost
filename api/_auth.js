// api/_auth.js — вспомогательные функции авторизации

const { getDB } = require('./_db');

/**
 * Извлекает session-токен из cookie или заголовка Authorization.
 * Возвращает объект сессии или null если токен невалиден / истёк.
 * Все ID хранятся как TEXT — никаких ::uuid приведений.
 * GET /api/user НЕ обновляет expires_at — это делается только при логине.
 */
async function getSessionUser(req) {
  // 1) Пробуем из Authorization: Bearer <token>
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2) Пробуем из cookie kbpost_session
  if (!token && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies['kbpost_session'] || null;
  }

  if (!token) return null;

  try {
    const sql = getDB();
    // Токен — TEXT, прямое сравнение строк, без ::uuid
    // Read-only: НЕ обновляем expires_at, чтобы избежать конфликтов при частых F5
    const rows = await sql`
      SELECT s.user_id, u.username, u.is_admin, u.telegram_id,
             u.citizenship, u.account, u.balance,
             u.subscription_active, u.subscription_expires
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token}
        AND s.expires_at > NOW()
      LIMIT 1
    `;
    if (!rows.length) return null;
    const r = rows[0];
    return {
      userId:      r.user_id,
      username:    r.username,
      isAdmin:     r.is_admin,
      telegramId:  r.telegram_id,
      citizenship: r.citizenship,
      account:     r.account,
      balance:     r.balance,
      token,
    };
  } catch (err) {
    console.error('getSessionUser error:', err.message);
    return null;
  }
}

function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) result[k.trim()] = decodeURIComponent(v.join('='));
  }
  return result;
}

/**
 * CORS заголовки — конкретный origin (не *) + Allow-Credentials: true.
 */
function corsHeaders(origin) {
  const allowed = [
    'https://kbpost.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const o = (origin && allowed.includes(origin)) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin':      o,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, Authorization',
  };
}

/**
 * Устанавливает cookie сессии для обычного браузера.
 * SameSite=Lax — работает при переходе по ссылкам из бота,
 * не блокируется современными браузерами в отличие от None.
 */
function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `kbpost_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`
  );
}

/**
 * Стирает cookie сессии.
 */
function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    'kbpost_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0'
  );
}

module.exports = { getSessionUser, corsHeaders, parseCookies, setSessionCookie, clearSessionCookie };
