// api/auth.js — авторизация, регистрация, токены бота
// Все ID и токены хранятся как TEXT. Никаких ::uuid приведений.

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDB } = require('./_db');
const { corsHeaders, getSessionUser } = require('./_auth');

// Генерирует случайную строку для использования как TEXT-токен или TEXT-ID
function generateId() {
  return crypto.randomUUID();
}

// Генерирует короткий TEXT-ID для пользователей (8 символов hex)
function generateUserId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDB();

  try {
    const { action } = req.body || req.query || {};

    // ===== 1. LOGIN =====
    if (action === 'login' && req.method === 'POST') {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
      }

      const rows = await sql`
        SELECT id, username, password_hash, is_admin, telegram_id,
               citizenship, account, balance, created_at,
               subscription_active, subscription_expires
        FROM users
        WHERE LOWER(username) = LOWER(${username})
        LIMIT 1
      `;

      if (!rows.length) {
        return res.status(401).json({ error: 'Неверный никнейм или пароль' });
      }

      const user = rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Неверный никнейм или пароль' });
      }

      const token = generateId();
      await sql`
        INSERT INTO sessions (token, user_id)
        VALUES (${token}, ${user.id})
      `;

      res.setHeader('Set-Cookie',
        `kbpost_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 3600}`
      );

      const now = new Date();
      const subExpires = user.subscription_expires ? new Date(user.subscription_expires) : null;
      const subscriptionActive = user.subscription_active && subExpires && subExpires > now;

      return res.status(200).json({
        token,
        user: {
          id:                  user.id,
          username:            user.username,
          isAdmin:             user.is_admin,
          telegramId:          user.telegram_id,
          telegramUsername:    user.telegram_id ? `@${user.telegram_id}` : '',
          citizenship:         user.citizenship,
          account:             user.account,
          balance:             user.balance,
          createdAt:           user.created_at,
          subscriptionActive:  !!subscriptionActive,
          subscriptionExpires: user.subscription_expires || null,
        },
      });
    }

    // ===== 2. REGISTER =====
    if (action === 'register' && req.method === 'POST') {
      const { username, password, telegramUsername, citizenship, account } = req.body;

      if (!username?.trim() || !password || password.length < 4 ||
          !telegramUsername?.trim() || !citizenship?.trim() || !account?.trim()) {
        return res.status(400).json({ error: 'Заполните все поля (пароль мин. 4 символа)' });
      }

      const existing = await sql`
        SELECT id FROM users WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1
      `;
      if (existing.length) {
        return res.status(409).json({ error: 'Пользователь с таким никнеймом уже существует' });
      }

      const tgNorm = telegramUsername.replace(/^@/, '').toLowerCase();
      const tgExisting = await sql`
        SELECT id FROM users WHERE telegram_id = ${tgNorm} LIMIT 1
      `;
      if (tgExisting.length) {
        return res.status(409).json({ error: 'Этот Telegram уже привязан к другому аккаунту' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUserId = generateUserId();

      await sql`
        INSERT INTO users (id, username, password_hash, telegram_id, citizenship, account, is_admin)
        VALUES (${newUserId}, ${username.trim()}, ${passwordHash}, ${tgNorm}, ${citizenship.trim()}, ${account.trim()}, FALSE)
      `;

      const newUserRows = await sql`
        SELECT id, username, is_admin, telegram_id, citizenship, account, balance, created_at
        FROM users WHERE id = ${newUserId} LIMIT 1
      `;
      const user = newUserRows[0];

      const token = generateId();
      await sql`
        INSERT INTO sessions (token, user_id)
        VALUES (${token}, ${user.id})
      `;

      res.setHeader('Set-Cookie',
        `kbpost_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 3600}`
      );

      return res.status(201).json({
        token,
        user: {
          id:                  user.id,
          username:            user.username,
          isAdmin:             user.is_admin,
          telegramId:          user.telegram_id,
          telegramUsername:    user.telegram_id ? `@${user.telegram_id}` : '',
          citizenship:         user.citizenship,
          account:             user.account,
          balance:             user.balance,
          createdAt:           user.created_at,
          subscriptionActive:  false,
          subscriptionExpires: null,
        },
      });
    }

    // ===== 3. LOGOUT =====
    if (action === 'logout') {
      const session = await getSessionUser(req);
      if (session) {
        await sql`DELETE FROM sessions WHERE token = ${session.token}`;
      }
      res.setHeader('Set-Cookie',
        'kbpost_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0'
      );
      return res.status(200).json({ ok: true });
    }

    // ===== 4. CREATE TOKEN (вызывается ботом) =====
    if (action === 'createToken') {
      const secret = req.headers['x-bot-secret'];
      if (!secret || secret !== process.env.BOT_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { actionType, data } = req.body;
      if (!actionType || !data) {
        return res.status(400).json({ error: 'actionType и data обязательны' });
      }
      // Генерируем UUID явно — поле token не имеет DEFAULT в БД
      const token = generateId();
      await sql`
        INSERT INTO pending_actions (token, action_type, data)
        VALUES (${token}, ${actionType}, ${JSON.stringify(data)}::jsonb)
      `;
      return res.status(201).json({ token });
    }

    // ===== 5. CHECK TOKEN =====
    if (action === 'checkToken' && req.method === 'POST') {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'token обязателен' });

      console.log('checkToken — ищем токен:', token);

      const rows = await sql`
        SELECT token, action_type, data, expires_at
        FROM pending_actions
        WHERE token = ${token}
          AND expires_at > NOW()
        LIMIT 1
      `;

      if (!rows.length) {
        // Диагностика: токен есть, но просрочен?
        const anyRows = await sql`
          SELECT token, expires_at FROM pending_actions WHERE token = ${token} LIMIT 1
        `;
        if (anyRows.length) {
          console.log('checkToken — токен просрочен. expires_at:', anyRows[0].expires_at, '| NOW:', new Date().toISOString());
          return res.status(404).json({ error: 'Токен истёк' });
        }
        console.log('checkToken — токен отсутствует в таблице pending_actions');
        return res.status(404).json({ error: 'Токен не найден' });
      }

      console.log('checkToken — найден. action_type:', rows[0].action_type, '| expires_at:', rows[0].expires_at);

      return res.status(200).json({
        actionType: rows[0].action_type,
        data:       rows[0].data,
      });
    }

    // ===== 6. CONFIRM (применить токен) =====
    if (action === 'confirm' && req.method === 'POST') {
      const { token, password } = req.body;
      if (!token) return res.status(400).json({ error: 'token обязателен' });

      console.log('confirm — ищем токен:', token);

      const rows = await sql`
        SELECT token, action_type, data, expires_at
        FROM pending_actions
        WHERE token = ${token}
          AND expires_at > NOW()
        LIMIT 1
      `;

      if (!rows.length) {
        const anyRows = await sql`
          SELECT token, expires_at FROM pending_actions WHERE token = ${token} LIMIT 1
        `;
        if (anyRows.length) {
          console.log('confirm — токен просрочен. expires_at:', anyRows[0].expires_at, '| NOW:', new Date().toISOString());
          return res.status(404).json({ error: 'Токен истёк' });
        }
        console.log('confirm — токен отсутствует в таблице pending_actions');
        return res.status(404).json({ error: 'Токен не найден или истёк' });
      }

      console.log('confirm — найден. action_type:', rows[0].action_type);

      const { action_type, data } = rows[0];

      if (action_type === 'link_tg') {
        const tgNorm = data.tgUsername ? data.tgUsername.replace(/^@/, '').toLowerCase() : null;
        if (!tgNorm) {
          await sql`DELETE FROM pending_actions WHERE token = ${token}`;
          return res.status(400).json({ error: 'Отсутствует tgUsername в данных токена' });
        }

        // Проверяем, не занят ли этот Telegram другим пользователем
        const conflictRows = await sql`
          SELECT username FROM users
          WHERE telegram_id = ${tgNorm}
            AND LOWER(username) != LOWER(${data.siteUsername})
          LIMIT 1
        `;
        if (conflictRows.length) {
          await sql`DELETE FROM pending_actions WHERE token = ${token}`;
          return res.status(409).json({
            error: `Telegram уже привязан к аккаунту «${conflictRows[0].username}»`,
          });
        }

        await sql`
          UPDATE users SET telegram_id = ${tgNorm}
          WHERE LOWER(username) = LOWER(${data.siteUsername})
        `;
        console.log('confirm link_tg — обновлён telegram_id:', tgNorm, 'для пользователя:', data.siteUsername);

      } else if (action_type === 'reset_password') {
        if (!password || password.length < 4) {
          return res.status(400).json({ error: 'Пароль должен быть от 4 символов' });
        }
        const hash = await bcrypt.hash(password, 10);
        await sql`
          UPDATE users SET password_hash = ${hash}
          WHERE LOWER(username) = LOWER(${data.siteUsername})
        `;
        // Инвалидируем все сессии пользователя после сброса пароля
        const userRows = await sql`
          SELECT id FROM users WHERE LOWER(username) = LOWER(${data.siteUsername}) LIMIT 1
        `;
        if (userRows.length) {
          await sql`DELETE FROM sessions WHERE user_id = ${userRows[0].id}`;
        }
        console.log('confirm reset_password — пароль сброшен для:', data.siteUsername);
      }

      // Удаляем использованный токен, чтобы не засорять базу
      await sql`DELETE FROM pending_actions WHERE token = ${token}`;

      return res.status(200).json({ ok: true, action: action_type });
    }

    return res.status(405).json({ error: 'Неизвестное действие' });

  } catch (err) {
    console.error('auth handler error:', err.message);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};
