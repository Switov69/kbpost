// api/auth/confirm.js — POST /api/auth/confirm
// Выполняет действие (link_tg, reset_password) и удаляет токен

const bcrypt = require('bcryptjs');
const { getDB } = require('../_db');
const { corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Токен не указан' });

  try {
    const sql = getDB();

    // Получаем токен
    const rows = await sql`
      SELECT token, action_type, data
      FROM pending_actions
      WHERE token = ${token}::uuid
        AND expires_at > NOW()
      LIMIT 1
    `;
    if (!rows.length) {
      return res.status(404).json({ error: 'Токен недействителен или истёк' });
    }

    const { action_type, data } = rows[0];

    // === ПРИВЯЗКА TELEGRAM ===
    if (action_type === 'link_tg') {
      const { siteUsername, tgUsername } = data;
      const tgNorm = tgUsername.replace(/^@/, '').toLowerCase();

      // Проверяем что TG не занят другим пользователем
      const tgExisting = await sql`
        SELECT id, username FROM users
        WHERE telegram_id = ${tgNorm}
          AND LOWER(username) != LOWER(${siteUsername})
        LIMIT 1
      `;
      if (tgExisting.length) {
        return res.status(409).json({
          error: `Этот Telegram уже привязан к аккаунту ${tgExisting[0].username}`,
        });
      }

      // Ищем пользователя и обновляем
      const updateResult = await sql`
        UPDATE users SET telegram_id = ${tgNorm}
        WHERE LOWER(username) = LOWER(${siteUsername})
        RETURNING id
      `;
      if (!updateResult.length) {
        return res.status(404).json({ error: `Пользователь ${siteUsername} не найден` });
      }

      // Удаляем токен
      await sql`DELETE FROM pending_actions WHERE token = ${token}::uuid`;

      return res.status(200).json({ ok: true, action: 'link_tg', tgUsername });
    }

    // === СБРОС ПАРОЛЯ ===
    if (action_type === 'reset_password') {
      const { siteUsername } = data;

      if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Пароль должен быть от 4 символов' });
      }

      const hash = await bcrypt.hash(password, 10);
      const updateResult = await sql`
        UPDATE users SET password_hash = ${hash}
        WHERE LOWER(username) = LOWER(${siteUsername})
        RETURNING id
      `;
      if (!updateResult.length) {
        return res.status(404).json({ error: `Пользователь ${siteUsername} не найден` });
      }

      // Удаляем все сессии этого пользователя (принудительный logout)
      await sql`DELETE FROM sessions WHERE user_id = ${updateResult[0].id}::uuid`;
      // Удаляем токен
      await sql`DELETE FROM pending_actions WHERE token = ${token}::uuid`;

      return res.status(200).json({ ok: true, action: 'reset_password' });
    }

    return res.status(400).json({ error: `Неизвестное действие: ${action_type}` });
  } catch (err) {
    console.error('confirm error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
