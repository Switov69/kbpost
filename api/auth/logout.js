// api/auth/logout.js — POST /api/auth/logout

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (session) {
    try {
      const sql = getDB();
      await sql`DELETE FROM sessions WHERE token = ${session.token}::uuid`;
    } catch (err) {
      console.error('Logout DB error:', err);
    }
  }

  // Удаляем cookie
  res.setHeader('Set-Cookie',
    'kbpost_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0'
  );
  return res.status(200).json({ ok: true });
};
