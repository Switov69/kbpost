const bcrypt = require('bcryptjs');
const { getDB } = require('./_db');
const { getSessionUser, corsHeaders } = require('./_auth');

function mapUser(u) {
  const now = new Date();
  const subExpires = u.subscription_expires ? new Date(u.subscription_expires) : null;
  const subscriptionActive = u.subscription_active && subExpires && subExpires > now;
  return {
    id: u.id,
    username: u.username,
    isAdmin: u.is_admin,
    telegramId: u.telegram_id,
    telegramUsername: u.telegram_id ? `@${u.telegram_id}` : '',
    citizenship: u.citizenship,
    account: u.account,
    balance: u.balance,
    createdAt: u.created_at,
    subscriptionActive: !!subscriptionActive,
    subscriptionExpires: u.subscription_expires || null,
  };
}

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  const sql = getDB();

  try {
    // ===== GET =====
    if (req.method === 'GET') {
      const { type } = req.query;

      if (type === 'all') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        const users = await sql`
          SELECT id, username, is_admin, telegram_id, citizenship, account, balance,
                 subscription_active, subscription_expires, created_at
          FROM users ORDER BY created_at ASC
        `;
        return res.status(200).json(users.map(mapUser));
      }

      // Список запросов на подписку (admin)
      if (type === 'subscriptionRequests') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        const requests = await sql`
          SELECT id, user_id, username, amount, status, created_at
          FROM subscription_requests
          WHERE status = 'pending'
          ORDER BY created_at ASC
        `;
        return res.status(200).json(requests.map(r => ({
          id: r.id,
          userId: r.user_id,
          username: r.username,
          amount: r.amount,
          status: r.status,
          createdAt: r.created_at,
        })));
      }

      // Профиль текущего пользователя
      const rows = await sql`
        SELECT id, username, is_admin, telegram_id, citizenship, account, balance,
               subscription_active, subscription_expires, created_at
        FROM users WHERE id = ${session.userId}::uuid LIMIT 1
      `;
      if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
      return res.status(200).json(mapUser(rows[0]));
    }

    // ===== POST =====
    if (req.method === 'POST') {
      const { action } = req.body;

      // Смена пароля
      if (action === 'changePassword') {
        const { oldPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 4)
          return res.status(400).json({ error: 'Пароль должен быть от 4 символов' });
        const rows = await sql`SELECT password_hash FROM users WHERE id = ${session.userId}::uuid`;
        if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
        const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Неверный текущий пароль' });
        const newHash = await bcrypt.hash(newPassword, 10);
        await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${session.userId}::uuid`;
        return res.status(200).json({ ok: true });
      }

      // Обновление счёта
      if (action === 'updateAccount') {
        const { account } = req.body;
        if (!account?.trim()) return res.status(400).json({ error: 'Укажите счёт' });
        await sql`UPDATE users SET account = ${account.trim()} WHERE id = ${session.userId}::uuid`;
        return res.status(200).json({ ok: true });
      }

      // Запрос на покупку подписки (пользователь нажал "Я оплатил")
      if (action === 'requestSubscription') {
        // Проверяем что нет уже активного pending-запроса
        const existing = await sql`
          SELECT id FROM subscription_requests
          WHERE user_id = ${session.userId}::uuid AND status = 'pending'
          LIMIT 1
        `;
        if (existing.length) {
          return res.status(409).json({ error: 'Запрос уже отправлен, ожидайте подтверждения' });
        }
        // Проверяем что подписка не активна
        const uRows = await sql`
          SELECT subscription_active, subscription_expires FROM users WHERE id = ${session.userId}::uuid
        `;
        const u = uRows[0];
        if (u.subscription_active && u.subscription_expires && new Date(u.subscription_expires) > new Date()) {
          return res.status(400).json({ error: 'Подписка уже активна' });
        }
        await sql`
          INSERT INTO subscription_requests (user_id, username, amount)
          VALUES (${session.userId}::uuid, ${session.username}, 5)
        `;
        return res.status(201).json({ ok: true });
      }

      // Подтверждение подписки (только admin)
      if (action === 'confirmSubscription') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        const { requestId } = req.body;
        if (!requestId) return res.status(400).json({ error: 'requestId обязателен' });

        const reqRows = await sql`
          SELECT * FROM subscription_requests WHERE id = ${requestId}::uuid LIMIT 1
        `;
        if (!reqRows.length) return res.status(404).json({ error: 'Запрос не найден' });
        if (reqRows[0].status !== 'pending') return res.status(400).json({ error: 'Запрос уже обработан' });

        // Активируем подписку на 1 месяц
        await sql`
          UPDATE users
          SET subscription_active  = TRUE,
              subscription_expires = NOW() + INTERVAL '30 days'
          WHERE id = ${reqRows[0].user_id}::uuid
        `;
        await sql`
          UPDATE subscription_requests SET status = 'confirmed' WHERE id = ${requestId}::uuid
        `;
        return res.status(200).json({ ok: true });
      }

      // Отклонение подписки (только admin)
      if (action === 'rejectSubscription') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        const { requestId } = req.body;
        await sql`
          UPDATE subscription_requests SET status = 'rejected' WHERE id = ${requestId}::uuid AND status = 'pending'
        `;
        return res.status(200).json({ ok: true });
      }

      // Управление пользователями (admin)
      if (['makeAdmin', 'removeAdmin', 'delete', 'updateBalance'].includes(action)) {
        if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        const { userId, balance } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId обязателен' });

        if (action === 'makeAdmin')
          await sql`UPDATE users SET is_admin = TRUE WHERE id = ${userId}::uuid`;
        if (action === 'removeAdmin')
          await sql`UPDATE users SET is_admin = FALSE WHERE id = ${userId}::uuid`;
        if (action === 'updateBalance')
          await sql`UPDATE users SET balance = ${parseInt(balance, 10)} WHERE id = ${userId}::uuid`;
        if (action === 'delete') {
          await sql`DELETE FROM sessions WHERE user_id = ${userId}::uuid`;
          await sql`DELETE FROM users WHERE id = ${userId}::uuid`;
        }
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (err) {
    console.error('user handler error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};
