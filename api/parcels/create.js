// api/parcels/create.js — POST /api/parcels/create

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

async function generateTTN(sql) {
  // Генерируем уникальный ТТН вида #0001–#9999
  for (let attempt = 0; attempt < 20; attempt++) {
    const num = Math.floor(1 + Math.random() * 9999);
    const ttn = `#${num.toString().padStart(4, '0')}`;
    const existing = await sql`SELECT id FROM parcels WHERE ttn = ${ttn} LIMIT 1`;
    if (!existing.length) return ttn;
  }
  // Фолбэк: timestamp-based
  return `#${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  const {
    description,
    receiverUsername,
    fromBranchId,
    toBranchId,
    toCoordinates,
    cashOnDelivery,
    cashOnDeliveryAmount,
  } = req.body || {};

  if (!description?.trim())     return res.status(400).json({ error: 'Укажите описание' });
  if (!receiverUsername?.trim()) return res.status(400).json({ error: 'Укажите получателя' });
  if (!fromBranchId?.trim())     return res.status(400).json({ error: 'Укажите отделение отправки' });

  try {
    const sql = getDB();

    // Ищем получателя
    const receiverRows = await sql`
      SELECT id, username FROM users WHERE LOWER(username) = LOWER(${receiverUsername.trim()}) LIMIT 1
    `;
    if (!receiverRows.length) {
      return res.status(404).json({ error: `Пользователь "${receiverUsername}" не найден` });
    }
    const receiver = receiverRows[0];

    if (receiver.id === session.userId) {
      return res.status(400).json({ error: 'Нельзя отправить посылку самому себе' });
    }

    const ttn = await generateTTN(sql);
    const now = new Date().toISOString();
    const statusHistory = JSON.stringify([{ status: 1, label: 'Посылка оформлена', timestamp: now }]);

    const amount = cashOnDelivery ? (parseInt(cashOnDeliveryAmount, 10) || 0) : 0;

    const newParcel = await sql`
      INSERT INTO parcels (
        ttn, sender_id, receiver_id,
        sender_username, receiver_username,
        status, status_history,
        description, from_branch_id, to_branch_id, to_coordinates,
        cash_on_delivery, cash_on_delivery_amount
      ) VALUES (
        ${ttn},
        ${session.userId}::uuid,
        ${receiver.id}::uuid,
        ${session.username},
        ${receiver.username},
        1,
        ${statusHistory}::jsonb,
        ${description.trim()},
        ${fromBranchId},
        ${toBranchId || null},
        ${toCoordinates || null},
        ${!!cashOnDelivery},
        ${amount}
      )
      RETURNING *
    `;

    const p = newParcel[0];
    return res.status(201).json({
      id:                       p.id,
      ttn:                      p.ttn,
      description:              p.description,
      senderId:                 p.sender_id,
      receiverId:               p.receiver_id,
      senderUsername:           p.sender_username,
      receiverUsername:         p.receiver_username,
      status:                   p.status,
      statusHistory:            p.status_history,
      fromBranchId:             p.from_branch_id,
      toBranchId:               p.to_branch_id,
      toCoordinates:            p.to_coordinates,
      cashOnDelivery:           p.cash_on_delivery,
      cashOnDeliveryAmount:     p.cash_on_delivery_amount,
      cashOnDeliveryPaid:       p.cash_on_delivery_paid,
      cashOnDeliveryConfirmed:  p.cash_on_delivery_confirmed,
      createdAt:                p.created_at,
      updatedAt:                p.updated_at,
    });
  } catch (err) {
    console.error('create parcel error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
