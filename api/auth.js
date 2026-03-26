const bcrypt = require('bcryptjs');
const { getDB } = require('./_db');
const { corsHeaders, getSessionUser } = require('./_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDB();

  try {
    const { action } = req.body || req.query || {};

    // 1. LOGIN (из login.js)
    if (action === 'login' && req.method === 'POST') {
      const { username, password } = req.body;
      const rows = await sql`SELECT * FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1`;
      if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
        return res.status(401).json({ error: 'Неверный никнейм или пароль' });
      }
      const user = rows[0];
      const sessionRows = await sql`INSERT INTO sessions (user_id) VALUES (${user.id}::uuid) RETURNING token`;
      const token = sessionRows[0].token;
      res.setHeader('Set-Cookie', `kbpost_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 3600}`);
      return res.status(200).json({ token, user: { id: user.id, username: user.username, isAdmin: user.is_admin } });
    }

    // 2. REGISTER (из register.js)
    if (action === 'register' && req.method === 'POST') {
      const { username, password, telegramUsername, citizenship, account } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await sql`
        INSERT INTO users (username, password_hash, telegram_id, citizenship, account, is_admin)
        VALUES (${username.trim()}, ${passwordHash}, ${telegramUsername}, ${citizenship}, ${account}, FALSE)
        RETURNING id, username
      `;
      return res.status(201).json(newUser[0]);
    }

    // 3. LOGOUT (из logout.js)
    if (action === 'logout') {
      const session = await getSessionUser(req);
      if (session) await sql`DELETE FROM sessions WHERE token = ${session.token}::uuid`;
      res.setHeader('Set-Cookie', 'kbpost_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0');
      return res.status(200).json({ ok: true });
    }

    // 4. РАБОТА С ТОКЕНАМИ БОТА (create-token, check-token, confirm)
    if (action === 'createToken') {
      const secret = req.headers['x-bot-secret'];
      if (secret !== process.env.BOT_SECRET) return res.status(403).json({ error: 'Forbidden' });
      const { actionType, data } = req.body;
      const rows = await sql`INSERT INTO pending_actions (action_type, data) VALUES (${actionType}, ${data}) RETURNING token`;
      return res.status(200).json({ token: rows[0].token });
    }

    if (action === 'checkToken') {
      const { token } = req.body;
      const rows = await sql`SELECT * FROM pending_actions WHERE token = ${token}::uuid AND expires_at > NOW()`;
      if (!rows.length) return res.status(404).json({ error: 'Токен истек' });
      return res.status(200).json(rows[0]);
    }

    if (action === 'confirm' && req.method === 'POST') {
        const { token, password } = req.body;
        const rows = await sql`SELECT * FROM pending_actions WHERE token = ${token}::uuid AND expires_at > NOW()`;
        if (!rows.length) return res.status(404).json({ error: 'Токен не найден' });
        
        const { action_type, data } = rows[0];
        if (action_type === 'link_tg') {
            await sql`UPDATE users SET telegram_id = ${data.tgUsername} WHERE LOWER(username) = LOWER(${data.siteUsername})`;
        } else if (action_type === 'reset_password') {
            const hash = await bcrypt.hash(password, 10);
            await sql`UPDATE users SET password_hash = ${hash} WHERE LOWER(username) = LOWER(${data.siteUsername})`;
        }
        await sql`DELETE FROM pending_actions WHERE token = ${token}::uuid`;
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method or action not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};