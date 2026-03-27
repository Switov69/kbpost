const { getDB } = require('./_db');
const { getSessionUser, corsHeaders } = require('./_auth');

// Вспомогательная функция для генерации ТТН (из твоего create.js)
async function generateTTN(sql) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const num = Math.floor(1 + Math.random() * 9999);
    const ttn = `#${num.toString().padStart(4, '0')}`;
    const existing = await sql`SELECT id FROM parcels WHERE ttn = ${ttn} LIMIT 1`;
    if (!existing.length) return ttn;
  }
  return `#${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

// Маппинг данных — полный список полей
function mapParcel(p) {
  return {
    id:                       p.id,
    ttn:                      p.ttn,
    description:              p.description,
    senderId:                 p.sender_id,
    receiverId:               p.receiver_id,
    senderUsername:           p.sender_username,
    receiverUsername:         p.receiver_username,
    status:                   p.status,
    statusHistory:            p.status_history || [],
    fromBranchId:             p.from_branch_id,
    toBranchId:               p.to_branch_id,
    toCoordinates:            p.to_coordinates,
    cashOnDelivery:           p.cash_on_delivery,
    cashOnDeliveryAmount:     p.cash_on_delivery_amount,
    cashOnDeliveryPaid:       p.cash_on_delivery_paid,
    cashOnDeliveryConfirmed:  p.cash_on_delivery_confirmed,
    createdAt:                p.created_at,
    updatedAt:                p.updated_at,
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
    // === ЛОГИКА ИЗ index.js (Получение списка) ===
    if (req.method === 'GET') {
      let parcels = session.isAdmin 
        ? await sql`SELECT * FROM parcels ORDER BY created_at DESC`
        : await sql`SELECT * FROM parcels WHERE sender_id = ${session.userId}::uuid OR receiver_id = ${session.userId}::uuid ORDER BY created_at DESC`;
      return res.status(200).json(parcels.map(mapParcel));
    }

    // === ЛОГИКА ИЗ create.js / update.js (Создание и изменение) ===
    if (req.method === 'POST') {
      const { action, parcelId } = req.body || {};

      // Создание посылки
      if (action === 'create') {
        const { description, receiverUsername, fromBranchId, toBranchId, toCoordinates, cashOnDelivery, cashOnDeliveryAmount } = req.body;
        if (!description?.trim()) return res.status(400).json({ error: 'Укажите описание' });
        if (!receiverUsername?.trim()) return res.status(400).json({ error: 'Укажите получателя' });
        if (!fromBranchId?.trim()) return res.status(400).json({ error: 'Укажите отделение' });

        const ttn = await generateTTN(sql);

        // Поиск получателя
        const users = await sql`SELECT id, username FROM users WHERE LOWER(username) = LOWER(${receiverUsername.trim()}) LIMIT 1`;
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
        return res.status(201).json(mapParcel(newParcel[0]));
      }

      // Обновление статуса
      if (action === 'updateStatus') {
        if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });
        const { newStatus } = req.body;
        const ns = parseInt(newStatus, 10);
        if (!ns) return res.status(400).json({ error: 'Неверный статус' });

        const STATUS_LABELS = {
          1: 'Посылка оформлена', 2: 'Приняли в отделении', 3: 'Выехала из отделения',
          4: 'Прибыла в терминал', 5: 'Выехала из терминала', 6: 'Прибыла в отделение',
          7: 'Получено в отделении', 8: 'Доставлена на координаты',
        };

        const rows = await sql`SELECT * FROM parcels WHERE id = ${parcelId}::uuid LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Посылка не найдена' });
        const parcel = rows[0];

        // Проверяем права
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

      // Пометить оплаченным (получатель нажал "Я оплатил")
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

    // === ЛОГИКА ИЗ delete.js (Удаление) ===
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