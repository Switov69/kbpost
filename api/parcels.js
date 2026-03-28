// api/parcels.js — управление посылками
// Все ID хранятся как TEXT. Никаких ::uuid приведений.

const https   = require('https');
const crypto  = require('crypto');
const { getDB } = require('./_db');
const { getSessionUser, corsHeaders } = require('./_auth');

const BOT_TOKEN  = process.env.BOT_TOKEN  || '';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://kbpost.vercel.app';

const STATUS_LABELS = {
  1: 'Посылка оформлена',
  2: 'Приняли в отделении',
  3: 'Выехала из отделения',
  4: 'Прибыла в терминал',
  5: 'Выехала из терминала',
  6: 'Прибыла в отделение',
  7: 'Получено в отделении',
  8: 'Доставлена на координаты',
};

// Генерирует уникальный ТТН вида #0001–#9999
async function generateTTN(sql) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const num = Math.floor(1 + Math.random() * 9999);
    const ttn = `#${num.toString().padStart(4, '0')}`;
    const existing = await sql`SELECT id FROM parcels WHERE ttn = ${ttn} LIMIT 1`;
    if (!existing.length) return ttn;
  }
  return `#${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

// Маппинг строки БД → объект для фронтенда
function mapParcel(p) {
  return {
    id:                      p.id,
    ttn:                     p.ttn,
    description:             p.description,
    senderId:                p.sender_id,
    receiverId:              p.receiver_id,
    senderUsername:          p.sender_username,
    receiverUsername:        p.receiver_username,
    status:                  p.status,
    statusHistory:           p.status_history || [],
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

// Уведомление всех админов в боте о новой посылке (fire-and-forget)
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
    for (const row of adminSessions) {
      const body = JSON.stringify({
        chat_id: row.chat_id,
        text: msgText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '📦 Открыть kbpost', web_app: { url: WEBAPP_URL } }]],
        },
      });
      await new Promise((resolve) => {
        const opts = {
          hostname: 'api.telegram.org',
          path: `/bot${BOT_TOKEN}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        };
        const req = https.request(opts, (r) => { r.resume(); resolve(); });
        req.on('error', () => resolve());
        req.write(body);
        req.end();
      });
    }
  } catch (err) {
    console.error('notifyAdminsNewParcel error:', err.message);
  }
}

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  const sql = getDB();

  try {
    // ===== GET — список посылок =====
    if (req.method === 'GET') {
      // session.userId — TEXT, без ::uuid
      const parcels = session.isAdmin
        ? await sql`SELECT * FROM parcels ORDER BY created_at DESC`
        : await sql`
            SELECT * FROM parcels
            WHERE sender_id = ${session.userId}
               OR receiver_id = ${session.userId}
            ORDER BY created_at DESC
          `;
      return res.status(200).json(parcels.map(mapParcel));
    }

    // ===== POST — создание и изменение =====
    if (req.method === 'POST') {
      const { action, parcelId } = req.body || {};

      // --- Создание посылки ---
      if (action === 'create') {
        const {
          description, receiverUsername, fromBranchId,
          toBranchId, toCoordinates, cashOnDelivery, cashOnDeliveryAmount,
        } = req.body;

        if (!description?.trim())     return res.status(400).json({ error: 'Укажите описание' });
        if (!receiverUsername?.trim()) return res.status(400).json({ error: 'Укажите получателя' });
        if (!fromBranchId?.trim())     return res.status(400).json({ error: 'Укажите отделение' });

        const ttn = await generateTTN(sql);

        // Ищем получателя — сравнение TEXT, без ::uuid
        const userRows = await sql`
          SELECT id, username FROM users
          WHERE LOWER(username) = LOWER(${receiverUsername.trim()})
          LIMIT 1
        `;
        if (!userRows.length) {
          return res.status(404).json({ error: `Пользователь "${receiverUsername}" не найден` });
        }
        const receiver = userRows[0];
        if (receiver.id === session.userId) {
          return res.status(400).json({ error: 'Нельзя отправить посылку самому себе' });
        }

        const now = new Date().toISOString();
        const statusHistory = JSON.stringify([{ status: 1, label: STATUS_LABELS[1], timestamp: now }]);
        const amount = cashOnDelivery ? (parseInt(cashOnDeliveryAmount, 10) || 0) : 0;

        // Генерируем TEXT id для посылки явно (нет DEFAULT gen_random_uuid())
        const parcelId = crypto.randomUUID();

        // sender_id и receiver_id — TEXT, без ::uuid
        await sql`
          INSERT INTO parcels (
            id, ttn, sender_id, receiver_id,
            sender_username, receiver_username,
            status, status_history, description,
            from_branch_id, to_branch_id, to_coordinates,
            cash_on_delivery, cash_on_delivery_amount
          ) VALUES (
            ${parcelId}, ${ttn}, ${session.userId}, ${receiver.id},
            ${session.username}, ${receiver.username},
            1, ${statusHistory}::jsonb, ${description.trim()},
            ${fromBranchId}, ${toBranchId || null}, ${toCoordinates || null},
            ${!!cashOnDelivery}, ${amount}
          )
        `;

        const newRows = await sql`SELECT * FROM parcels WHERE id = ${parcelId} LIMIT 1`;
        const created = mapParcel(newRows[0]);

        // Уведомляем админов (не блокируем ответ)
        notifyAdminsNewParcel(sql, created.ttn, created.senderUsername, created.receiverUsername)
          .catch(() => {});

        return res.status(201).json(created);
      }

      // --- Обновление статуса ---
      if (action === 'updateStatus') {
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        const ns = parseInt(req.body.newStatus, 10);
        if (!ns || !STATUS_LABELS[ns]) return res.status(400).json({ error: 'Неверный статус' });

        // parcelId — TEXT, без ::uuid
        const rows = await sql`SELECT * FROM parcels WHERE id = ${parcelId} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Посылка не найдена' });
        const parcel = rows[0];

        const isSender   = parcel.sender_id   === session.userId;
        const isReceiver = parcel.receiver_id === session.userId;
        if (!isSender && !isReceiver && !session.isAdmin) {
          return res.status(403).json({ error: 'Нет доступа к этой посылке' });
        }
        if (ns === 7 && parcel.cash_on_delivery && !parcel.cash_on_delivery_confirmed) {
          return res.status(400).json({ error: 'Сначала оплатите наложенный платёж' });
        }

        const nowStr = new Date().toISOString();
        const history = [
          ...(parcel.status_history || []),
          { status: ns, label: STATUS_LABELS[ns], timestamp: nowStr },
        ];

        const updated = await sql`
          UPDATE parcels
          SET status = ${ns},
              status_history = ${JSON.stringify(history)}::jsonb,
              updated_at = NOW()
          WHERE id = ${parcelId}
          RETURNING *
        `;
        return res.status(200).json(mapParcel(updated[0]));
      }

      // --- Пометить оплаченным (получатель нажал «Я оплатил») ---
      if (action === 'markPaid') {
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        // parcelId — TEXT, без ::uuid
        const rows = await sql`
          SELECT receiver_id FROM parcels WHERE id = ${parcelId} LIMIT 1
        `;
        if (!rows.length) return res.status(404).json({ error: 'Посылка не найдена' });
        if (rows[0].receiver_id !== session.userId && !session.isAdmin) {
          return res.status(403).json({ error: 'Нет доступа' });
        }
        const updated = await sql`
          UPDATE parcels SET cash_on_delivery_paid = TRUE, updated_at = NOW()
          WHERE id = ${parcelId} RETURNING *
        `;
        return res.status(200).json(mapParcel(updated[0]));
      }

      // --- Подтвердить оплату (только admin) ---
      if (action === 'confirmPayment') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Только администратор' });
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        // parcelId — TEXT, без ::uuid
        const updated = await sql`
          UPDATE parcels SET cash_on_delivery_confirmed = TRUE, updated_at = NOW()
          WHERE id = ${parcelId} RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Посылка не найдена' });
        return res.status(200).json(mapParcel(updated[0]));
      }

      // --- Обновление данных посылки (только admin) ---
      if (action === 'adminUpdate') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Только администратор' });
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        const { description, fromBranchId, toBranchId, toCoordinates } = req.body;
        // parcelId — TEXT, без ::uuid
        const updated = await sql`
          UPDATE parcels
          SET
            description    = COALESCE(${description ?? null}, description),
            from_branch_id = COALESCE(${fromBranchId ?? null}, from_branch_id),
            to_branch_id   = ${toBranchId !== undefined ? (toBranchId || null) : sql`to_branch_id`},
            to_coordinates = ${toCoordinates !== undefined ? (toCoordinates || null) : sql`to_coordinates`},
            updated_at     = NOW()
          WHERE id = ${parcelId}
          RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Посылка не найдена' });
        return res.status(200).json(mapParcel(updated[0]));
      }

      return res.status(400).json({ error: `Неизвестное действие: ${action}` });
    }

    // ===== DELETE — удаление посылки (только admin) =====
    if (req.method === 'DELETE') {
      if (!session.isAdmin) return res.status(403).json({ error: 'Только для администраторов' });
      const { parcelId } = req.body || {};
      if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
      // parcelId — TEXT, без ::uuid
      await sql`DELETE FROM parcels WHERE id = ${parcelId}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });

  } catch (err) {
    console.error('parcels handler error:', err.message);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};
