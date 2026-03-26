// api/parcels/index.js — GET /api/parcels
// Возвращает все посылки текущего пользователя (входящие + исходящие)

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  try {
    const sql = getDB();
    // Если admin — возвращаем все посылки, иначе только свои
    let parcels;
    if (session.isAdmin) {
      parcels = await sql`
        SELECT * FROM parcels ORDER BY created_at DESC
      `;
    } else {
      parcels = await sql`
        SELECT * FROM parcels
        WHERE sender_id = ${session.userId}::uuid
           OR receiver_id = ${session.userId}::uuid
        ORDER BY created_at DESC
      `;
    }

    return res.status(200).json(parcels.map(mapParcel));
  } catch (err) {
    console.error('parcels list error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

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
  };
}
