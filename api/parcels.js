const { getDB } = require('./_db');
const { getSessionUser, corsHeaders } = require('./_auth');

async function generateTTN(sql) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const num = Math.floor(1 + Math.random() * 9999);
    const ttn = `#${num.toString().padStart(4, '0')}`;
    const existing = await sql`SELECT id FROM parcels WHERE ttn = ${ttn} LIMIT 1`;
    if (!existing.length) return ttn;
  }
  return `#${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function mapParcel(p) {
  if (!p) return null;
  return {
    id: p.id, ttn: p.ttn, description: p.description,
    senderUsername: p.sender_username, receiverUsername: p.receiver_username,
    status: p.status, statusHistory: p.status_history,
    fromBranchId: p.from_branch_id, toBranchId: p.to_branch_id,
    createdAt: p.created_at, updatedAt: p.updated_at,
    cashOnDelivery: p.cash_on_delivery, amount: p.cash_on_delivery_amount
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
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM parcels 
        WHERE sender_id = ${session.userId} OR receiver_id = ${session.userId}
        ORDER BY created_at DESC
      `;
      return res.status(200).json(rows.map(mapParcel));
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'create') {
        const { receiverUsername, description, fromBranchId, toBranchId } = req.body;
        const ttn = await generateTTN(sql);

        const users = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${receiverUsername.trim()}) LIMIT 1`;
        if (!users.length) return res.status(404).json({ error: 'Получатель не найден' });

        const newParcel = await sql`
          INSERT INTO parcels (ttn, sender_id, receiver_id, sender_username, receiver_username, description, from_branch_id, to_branch_id)
          VALUES (${ttn}, ${session.userId}, ${users[0].id}, ${session.username}, ${receiverUsername}, ${description}, ${fromBranchId}, ${toBranchId})
          RETURNING *
        `;
        return res.status(201).json(mapParcel(newParcel[0]));
      }

      if (action === 'update') {
        if (!session.isAdmin) return res.status(403).json({ error: 'Только для админов' });
        const { parcelId, newStatus } = req.body;
        const updated = await sql`
          UPDATE parcels SET status = ${newStatus}, updated_at = NOW()
          WHERE id = ${parcelId} RETURNING *
        `;
        return res.status(200).json(mapParcel(updated[0]));
      }
    }

    if (req.method === 'DELETE') {
      if (!session.isAdmin) return res.status(403).json({ error: 'Только для админов' });
      const { parcelId } = req.body;
      await sql`DELETE FROM parcels WHERE id = ${parcelId}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};
