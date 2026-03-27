const https = require('https');
const { getDB } = require('./_db');
const { getSessionUser, corsHeaders } = require('./_auth');

const BOT_TOKEN  = process.env.BOT_TOKEN  || '';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://kbpost.vercel.app';

// Поля для списка посылок (без тяжёлых JSONB полей)
const LIST_FIELDS = `
  id, ttn, status, sender_id, receiver_id,
  sender_username, receiver_username,
  from_branch_id, to_branch_id, to_coordinates,
  cash_on_delivery, cash_on_delivery_amount, cash_on_delivery_paid, cash_on_delivery_confirmed,
  created_at, updated_at
`;

async function notifyAdminsNewParcel(sql, ttn, senderUsername, receiverUsername) {
  if (!BOT_TOKEN) return;
  try {
    const adminSessions = await sql`
      SELECT bs.chat_id
      FROM bot_sessions bs
      JOIN users u ON u.telegram_id = bs.tg_username
      WHERE u.is_admin = TRUE
    `;
    const msgText = `📦 <b>Новая посылка создана!</b>\n\nТТН: <code>${ttn}</code>\nОтправитель: <b>${senderUsername}</b>\nПолучатель: <b>${receiverUsername}</b>`;
    // Отправляем уведомления параллельно
    await Promise.all(adminSessions.map((row) =>
      new Promise((resolve) => {
        const body = JSON.stringify({
          chat_id: row.chat_id,
          text: msgText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '📦 Открыть kbpost', web_app: { url: WEBAPP_URL } }]] },
        });
        const opts = {
          hostname: 'api.telegram.org',
          path: `/bot${BOT_TOKEN}/sendMessage`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        };
        const req = https.request(opts, (r) => { r.resume(); resolve(); });
        req.on('error', () => resolve());
        req.write(body);
        req.end();
      })
    ));
  } catch (err) {
    console.error('notifyAdminsNewParcel error:', err.message);
  }
}

async function generateTTN(sql) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const num = Math.floor(1 + Math.random() * 9999);
    const ttn = `#${num.toString().padStart(4, '0')}`;
    const existing = await sql`SELECT id FROM parcels WHERE ttn = ${ttn} LIMIT 1`;
    if (!existing.length) return ttn;
  }
  return `#${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

// Маппинг для списка (без status_history)
function mapParcelList(p) {
  return {
    id:                      p.id,
    ttn:                     p.ttn,
    description:             p.description ?? null,
    senderId:                p.sender_id,
    receiverId:              p.receiver_id,
    senderUsername:          p.sender_username,
    receiverUsername:        p.receiver_username,
    status:                  p.status,
    statusHistory:           [], // не грузим в списке, только при детальном просмотре
    fromBranchId:            p.from_branch_id,
    toBranchId:              p.to_branch_id,
    toCoordinates:           p.to_coordinates,
    cashOnDelivery:          p.cash_on_delivery,
    cashOnDeliveryAmount:    p.cash_on_delivery_amount,
    cashOnDeliveryPaid:      p.cash_on_delivery_paid,
    cashOnDeliveryConfirmed: p.cash_on_delivery_confirmed,
    createdAt:               p.created_at,
    updatedAt:               p.updated_at,
  };
}

// Полный маппинг (со status_history) — для детального просмотра и операций
function mapParcel(p) {
  return {
    ...mapParcelList(p),
    statusHistory: p.status_history || [],
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
    // === GET — список посылок с пагинацией ===
    if (req.method === 'GET') {
      // Поддержка ?id=... для детального просмотра одной посылки (со status_history)
      const { id: parcelId, limit: limitParam, offset: offsetParam } = req.query;

      if (parcelId) {
        // Детальный просмотр — тянем ВСЕ поля включая status_history
        const rows = session.isAdmin
          ? await sql`SELECT * FROM parcels WHERE id = ${parcelId}::uuid LIMIT 1`
          : await sql`SELECT * FROM parcels WHERE id = ${parcelId}::uuid AND (sender_id = ${session.userId}::uuid OR receiver_id = ${session.userId}::uuid) LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Посылка не найдена' });
        return res.status(200).json(mapParcel(rows[0]));
      }

      // Пагинация — дефолт 20 записей
      const limit  = Math.min(Math.max(parseInt(limitParam,  10) || 20, 1), 100);
      const offset = Math.max(parseInt(offsetParam, 10) || 0, 0);

      // Выбираем только нужные поля (без status_history)
      const [parcels, totalRows] = session.isAdmin
        ? await Promise.all([
            sql`SELECT ${sql(LIST_FIELDS.trim().split(/,\s*/))} FROM parcels ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            sql`SELECT COUNT(*)::int AS count FROM parcels`,
          ])
        : await Promise.all([
            sql`SELECT ${sql(LIST_FIELDS.trim().split(/,\s*/))} FROM parcels WHERE sender_id = ${session.userId}::uuid OR receiver_id = ${session.userId}::uuid ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            sql`SELECT COUNT(*)::int AS count FROM parcels WHERE sender_id = ${session.userId}::uuid OR receiver_id = ${session.userId}::uuid`,
          ]);

      return res.status(200).json({
        items: parcels.map(mapParcelList),
        total: totalRows[0]?.count ?? 0,
        limit,
        offset,
      });
    }

    // === POST — создание и изменение ===
    if (req.method === 'POST') {
      const { action, parcelId } = req.body || {};

      // Создание посылки
      if (action === 'create') {
        const { description, receiverUsername, fromBranchId, toBranchId, toCoordinates, cashOnDelivery, cashOnDeliveryAmount } = req.body;
        if (!description?.trim())       return res.status(400).json({ error: 'Укажите описание' });
        if (!receiverUsername?.trim())  return res.status(400).json({ error: 'Укажите получателя' });
        if (!fromBranchId?.trim())      return res.status(400).json({ error: 'Укажите отделение' });

        // Генерация ТТН и поиск получателя — параллельно
        const [ttn, users] = await Promise.all([
          generateTTN(sql),
          sql`SELECT id, username FROM users WHERE LOWER(username) = LOWER(${receiverUsername.trim()}) LIMIT 1`,
        ]);

        if (!users.length) return res.status(404).json({ error: `Пользователь "${receiverUsername}" не найден` });
        const receiver = users[0];
        if (receiver.id === session.userId) return res.status(400).json({ error: 'Нельзя отправить посылку самому себе' });

        const now = new Date().toISOString();
        const statusHistory = JSON.stringify([{ status: 1, label: 'Посылка оформлена', timestamp: now }]);
        const amount = cashOnDelivery ? (parseInt(cashOnDeliveryAmount, 10) || 0) : 0;

        const newParcel = await sql`
          INSERT INTO parcels (
            ttn, sender_id, receiver_id, sender_username, receiver_username,
            status, status_history, description, from_branch_id, to_branch_id,
            to_coordinates, cash_on_delivery, cash_on_delivery_amount
          ) VALUES (
            ${ttn}, ${session.userId}::uuid, ${receiver.id}::uuid,
            ${session.username}, ${receiver.username},
            1, ${statusHistory}::jsonb, ${description.trim()},
            ${fromBranchId}, ${toBranchId || null}, ${toCoordinates || null},
            ${!!cashOnDelivery}, ${amount}
          )
          RETURNING *
        `;
        const created = mapParcel(newParcel[0]);
        notifyAdminsNewParcel(sql, created.ttn, created.senderUsername, created.receiverUsername).catch(() => {});
        return res.status(201).json(created);
      }

      // Обновление статуса
      if (action === 'updateStatus') {
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        const { newStatus } = req.body;
        const ns = parseInt(newStatus, 10);
        if (!ns) return res.status(400).json({ error: 'Неверный статус' });

        const STATUS_LABELS = {
          1: 'Посылка оформлена',       2: 'Приняли в отделении',
          3: 'Выехала из отделения',    4: 'Прибыла в терминал',
          5: 'Выехала из терминала',    6: 'Прибыла в отделение',
          7: 'Получено в отделении',    8: 'Доставлена на координаты',
        };

        const rows = await sql`SELECT * FROM parcels WHERE id = ${parcelId}::uuid LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Посылка не найдена' });
        const parcel = rows[0];

        const isSender   = parcel.sender_id   === session.userId;
        const isReceiver = parcel.receiver_id === session.userId;
        if (!isSender && !isReceiver && !session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });
        if (ns === 7 && parcel.cash_on_delivery && !parcel.cash_on_delivery_confirmed) {
          return res.status(400).json({ error: 'Сначала оплатите наложенный платёж' });
        }

        const now = new Date().toISOString();
        const history = [...(parcel.status_history || []), { status: ns, label: STATUS_LABELS[ns] || String(ns), timestamp: now }];

        const updated = await sql`
          UPDATE parcels
          SET status = ${ns}, status_history = ${JSON.stringify(history)}::jsonb, updated_at = NOW()
          WHERE id = ${parcelId}::uuid RETURNING *
        `;
        return res.status(200).json(mapParcel(updated[0]));
      }

      // Пометить оплаченным
      if (action === 'markPaid') {
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        const rows = await sql`SELECT receiver_id FROM parcels WHERE id = ${parcelId}::uuid LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Посылка не найдена' });
        if (rows[0].receiver_id !== session.userId && !session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });

        const updated = await sql`
          UPDATE parcels SET cash_on_delivery_paid = TRUE, updated_at = NOW()
          WHERE id = ${parcelId}::uuid RETURNING *
        `;
        return res.status(200).json(mapParcel(updated[0]));
      }

      // Подтвердить оплату (admin)
      if (action === 'confirmPayment') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Только администратор' });
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        const updated = await sql`
          UPDATE parcels SET cash_on_delivery_confirmed = TRUE, updated_at = NOW()
          WHERE id = ${parcelId}::uuid RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Посылка не найдена' });
        return res.status(200).json(mapParcel(updated[0]));
      }

      // Обновление данных посылки (admin)
      if (action === 'adminUpdate') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Только администратор' });
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        const { description, fromBranchId, toBranchId, toCoordinates } = req.body;
        const updated = await sql`
          UPDATE parcels
          SET
            description    = COALESCE(${description ?? null}, description),
            from_branch_id = COALESCE(${fromBranchId ?? null}, from_branch_id),
            to_branch_id   = ${toBranchId !== undefined ? toBranchId : null},
            to_coordinates = ${toCoordinates !== undefined ? toCoordinates : null},
            updated_at     = NOW()
          WHERE id = ${parcelId}::uuid RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Посылка не найдена' });
        return res.status(200).json(mapParcel(updated[0]));
      }

      return res.status(400).json({ error: `Неизвестное действие: ${action}` });
    }

    // === DELETE ===
    if (req.method === 'DELETE') {
      if (!session.isAdmin) return res.status(403).json({ error: 'Только для админов' });
      const { parcelId } = req.body;
      await sql`DELETE FROM parcels WHERE id = ${parcelId}::uuid`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};
