// api/branches/manage.js — POST /api/branches/manage (только admin)
// action: 'create' | 'update' | 'delete'

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

function genBranchId(region, number) {
  const prefix = region === 'Столица' ? 'br_stolica' : 'br_antegriya';
  return `${prefix}_${number}_${Date.now().toString(36)}`;
}

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });
  if (!session.isAdmin) return res.status(403).json({ error: 'Нет доступа' });

  const { action, id, number, region, prefecture, address } = req.body || {};

  try {
    const sql = getDB();

    if (action === 'create') {
      if (!number || !region) return res.status(400).json({ error: 'Укажите номер и регион' });
      const newId = genBranchId(region, number);
      const rows = await sql`
        INSERT INTO branches (id, number, region, prefecture, address)
        VALUES (${newId}, ${number}, ${region}, ${prefecture || ''}, ${address || ''})
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'id обязателен' });
      const rows = await sql`
        UPDATE branches
        SET number     = COALESCE(${number ?? null}, number),
            region     = COALESCE(${region ?? null}, region),
            prefecture = COALESCE(${prefecture ?? null}, prefecture),
            address    = COALESCE(${address ?? null}, address)
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return res.status(404).json({ error: 'Отделение не найдено' });
      return res.status(200).json(rows[0]);
    }

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id обязателен' });
      const rows = await sql`DELETE FROM branches WHERE id = ${id} RETURNING id`;
      if (!rows.length) return res.status(404).json({ error: 'Отделение не найдено' });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Неизвестное действие' });
  } catch (err) {
    console.error('branches manage error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
