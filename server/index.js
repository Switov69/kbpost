import express from 'express';
import cors from 'cors';
import { sql, initDB } from './db.js';
import { notifyNewParcel, notifyParcelUpdate, notifyPinReset, notifyParcelPaid } from '../bot.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const now = () => Date.now();
const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

await initDB();

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, time: now() }));

// TG users (for bot tracking)
app.post('/api/tg/track', async (req, res) => {
  const { tgId, username } = req.body;
  if (!tgId) return res.status(400).json({ error: 'tgId required' });
  
  await sql`
    INSERT INTO tg_users (tg_id, username, first_seen, last_seen)
    VALUES (${String(tgId)}, ${username || null}, ${now()}, ${now()})
    ON CONFLICT (tg_id) DO UPDATE SET
      username = EXCLUDED.username,
      last_seen = EXCLUDED.last_seen
  `;
  res.json({ ok: true });
});

// Users
app.get('/api/users/by-tg/:tgId', async (req, res) => {
  const rows = await sql`SELECT * FROM users WHERE tg_id = ${req.params.tgId} LIMIT 1`;
  res.json(rows[0] || null);
});

app.get('/api/users/by-nick/:nickname', async (req, res) => {
  const rows = await sql`SELECT * FROM users WHERE LOWER(nickname) = LOWER(${req.params.nickname}) LIMIT 1`;
  res.json(rows[0] || null);
});

app.get('/api/users/:id', async (req, res) => {
  const rows = await sql`SELECT * FROM users WHERE id = ${req.params.id} LIMIT 1`;
  res.json(rows[0] || null);
});

app.post('/api/users', async (req, res) => {
  const u = req.body;
  await sql`
    INSERT INTO users (id, nickname, tg_id, tg_username, avatar_url, citizenship, bank_account, pin, is_admin, created_at)
    VALUES (${u.id}, ${u.nickname}, ${u.tgId || null}, ${u.tgUsername || null}, ${u.avatarUrl || null}, ${u.citizenship || null}, ${u.bankAccount || null}, ${u.pin}, ${u.isAdmin || false}, ${u.createdAt || now()})
    ON CONFLICT (id) DO UPDATE SET
      nickname = EXCLUDED.nickname,
      tg_id = EXCLUDED.tg_id,
      tg_username = EXCLUDED.tg_username,
      avatar_url = EXCLUDED.avatar_url,
      citizenship = EXCLUDED.citizenship,
      bank_account = EXCLUDED.bank_account,
      pin = COALESCE(EXCLUDED.pin, users.pin),
      is_admin = EXCLUDED.is_admin
  `;
  res.json({ ok: true });
});

app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const patch = req.body;
  const fields = [];
  const values = [];
  
  for (const [k, v] of Object.entries(patch)) {
    const col = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
    fields.push(`${col} = $${fields.length + 1}`);
    values.push(v);
  }
  
  if (fields.length) {
    await sql.unsafe(`UPDATE users SET ${fields.join(', ')} WHERE id = $${fields.length + 1}`, [...values, id]);
  }
  res.json({ ok: true });
});

app.get('/api/users', async (req, res) => {
  const rows = await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 200`;
  res.json(rows);
});

// Link tokens
app.post('/api/link-token', async (req, res) => {
  const { userId, nickname } = req.body;
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expiresAt = now() + 5 * 60 * 1000;
  
  await sql`
    INSERT INTO link_tokens (token, user_id, nickname, expires_at)
    VALUES (${token}, ${userId}, ${nickname}, ${expiresAt})
  `;
  res.json({ token, expiresAt });
});

app.get('/api/link-token/:token', async (req, res) => {
  const rows = await sql`SELECT * FROM link_tokens WHERE token = ${req.params.token} LIMIT 1`;
  const t = rows[0];
  if (!t || t.expires_at < now()) return res.json(null);
  res.json(t);
});

app.post('/api/link-token/consume', async (req, res) => {
  const { token, tgId, tgUsername } = req.body;
  const rows = await sql`SELECT * FROM link_tokens WHERE token = ${token} LIMIT 1`;
  const t = rows[0];
  if (!t || t.expires_at < now()) return res.status(400).json({ error: 'expired' });
  
  // Upsert tg user
  await sql`
    INSERT INTO tg_users (tg_id, username, first_seen, last_seen)
    VALUES (${String(tgId)}, ${tgUsername || null}, ${now()}, ${now()})
    ON CONFLICT (tg_id) DO UPDATE SET username = EXCLUDED.username, last_seen = EXCLUDED.last_seen
  `;
  
  // Link or create user
  const existing = await sql`SELECT * FROM users WHERE id = ${t.user_id} LIMIT 1`;
  if (existing[0]) {
    await sql`UPDATE users SET tg_id = ${String(tgId)}, tg_username = ${tgUsername || null} WHERE id = ${t.user_id}`;
  } else {
    await sql`
      INSERT INTO users (id, nickname, tg_id, tg_username, avatar_url, created_at)
      VALUES (${t.user_id}, ${t.nickname}, ${String(tgId)}, ${tgUsername || null}, ${'https://minotar.net/avatar/' + encodeURIComponent(t.nickname) + '/128'}, ${now()})
    `;
  }
  
  await sql`DELETE FROM link_tokens WHERE token = ${token}`;
  res.json({ ok: true, userId: t.user_id });
});

// Branches
app.get('/api/branches', async (req, res) => {
  const rows = await sql`SELECT * FROM branches ORDER BY city, name`;
  res.json(rows);
});

app.post('/api/branches', async (req, res) => {
  const { name, city } = req.body;
  const id = genId();
  await sql`INSERT INTO branches (id, name, city) VALUES (${id}, ${name}, ${city})`;
  res.json({ id });
});

app.patch('/api/branches/:id', async (req, res) => {
  const { id } = req.params;
  const { name, city } = req.body;
  if (name) await sql`UPDATE branches SET name = ${name} WHERE id = ${id}`;
  if (city) await sql`UPDATE branches SET city = ${city} WHERE id = ${id}`;
  res.json({ ok: true });
});

app.delete('/api/branches/:id', async (req, res) => {
  await sql`DELETE FROM branches WHERE id = ${req.params.id}`;
  res.json({ ok: true });
});

// Parcels
app.get('/api/parcels', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json([]);
  const rows = await sql`
    SELECT p.*, 
      s.nickname as sender_nick, s.avatar_url as sender_avatar,
      r.nickname as recipient_nick, r.avatar_url as recipient_avatar,
      fb.name as from_branch_name, fb.city as from_city,
      tb.name as to_branch_name, tb.city as to_city
    FROM parcels p
    LEFT JOIN users s ON s.id = p.sender_id
    LEFT JOIN users r ON r.id = p.recipient_id
    LEFT JOIN branches fb ON fb.id = p.from_branch_id
    LEFT JOIN branches tb ON tb.id = p.to_branch_id
    WHERE p.sender_id = ${userId} OR p.recipient_id = ${userId}
    ORDER BY p.created_at DESC
    LIMIT 200
  `;
  res.json(rows);
});

app.post('/api/parcels', async (req, res) => {
  const p = req.body;
  const id = genId();
  const ts = now();
  
  await sql`
    INSERT INTO parcels (id, description, sender_id, recipient_id, from_branch_id, to_branch_id, cod_enabled, cod_amount, cod_paid, status, created_at, updated_at)
    VALUES (${id}, ${p.description}, ${p.senderId}, ${p.recipientId}, ${p.fromBranchId}, ${p.toBranchId}, ${!!p.codEnabled}, ${p.codAmount || null}, false, 'Создана', ${ts}, ${ts})
  `;
  
  // Get recipient and sender for notification
  const users = await sql`
    SELECT 
      s.nickname as sender_nick,
      r.tg_id as recipient_tg
    FROM users s, users r
    WHERE s.id = ${p.senderId} AND r.id = ${p.recipientId}
    LIMIT 1
  `;
  
  const info = users[0];
  if (info?.recipient_tg) {
    notifyNewParcel({
      recipientTgId: info.recipient_tg,
      parcelId: id,
      senderNick: info.sender_nick,
      description: p.description,
      codAmount: p.codEnabled ? p.codAmount : null,
    }).catch(() => {});
  }
  
  res.json({ id, recipientTgId: info?.recipient_tg || null });
});

app.patch('/api/parcels/:id', async (req, res) => {
  const { id } = req.params;
  const patch = req.body;
  const byUserId = req.body.byUserId;
  
  const sets = [];
  const values = [];
  let idx = 1;
  
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'byUserId') continue;
    const col = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
    sets.push(`${col} = $${idx++}`);
    values.push(v);
  }
  sets.push(`updated_at = $${idx++}`);
  values.push(now());
  values.push(id);
  
  await sql.unsafe(`UPDATE parcels SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  
  // Get parcel for notification
  const parcel = await sql`
    SELECT p.*, 
      s.tg_id as sender_tg, s.nickname as sender_nick,
      r.tg_id as recipient_tg, r.nickname as recipient_nick
    FROM parcels p
    LEFT JOIN users s ON s.id = p.sender_id
    LEFT JOIN users r ON r.id = p.recipient_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  
  const p = parcel[0];
  if (p && patch.status) {
    const byUser = byUserId ? await sql`SELECT nickname FROM users WHERE id = ${byUserId} LIMIT 1` : [];
    const byNick = byUser[0]?.nickname;
    
    // Notify both parties
    if (p.sender_tg) {
      notifyParcelUpdate({
        userIdTg: p.sender_tg,
        parcelId: id,
        status: patch.status,
        isRecipient: false,
        byNick,
      }).catch(() => {});
    }
    if (p.recipient_tg) {
      notifyParcelUpdate({
        userIdTg: p.recipient_tg,
        parcelId: id,
        status: patch.status,
        isRecipient: true,
        byNick,
      }).catch(() => {});
    }
  }
  
  res.json({ 
    ok: true, 
    parcel: p || null 
  });
});

app.post('/api/parcels/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { payerId } = req.body;
  
  await sql`UPDATE parcels SET cod_paid = true, status = 'Оплачена', updated_at = ${now()} WHERE id = ${id}`;
  
  // Notify sender
  const info = await sql`
    SELECT p.cod_amount, s.tg_id as sender_tg, r.nickname as payer_nick
    FROM parcels p
    LEFT JOIN users s ON s.id = p.sender_id
    LEFT JOIN users r ON r.id = p.recipient_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  
  const data = info[0];
  if (data?.sender_tg) {
    notifyParcelPaid({
      senderTgId: data.sender_tg,
      parcelId: id,
      amount: data.cod_amount,
      payerNick: data.payer_nick || 'Получатель',
    }).catch(() => {});
    
    notifyParcelUpdate({
      userIdTg: data.sender_tg,
      parcelId: id,
      status: 'Оплачена',
      isRecipient: false,
    }).catch(() => {});
  }
  
  res.json({ ok: true });
});

// PIN reset
app.post('/api/pin-reset/request', async (req, res) => {
  const { userId } = req.body;
  await sql`
    INSERT INTO pin_reset_requests (user_id, requested_at)
    VALUES (${userId}, ${now()})
    ON CONFLICT (user_id) DO UPDATE SET requested_at = EXCLUDED.requested_at
  `;
  const user = await sql`SELECT tg_id FROM users WHERE id = ${userId} LIMIT 1`;
  const tgId = user[0]?.tg_id;
  if (tgId) {
    notifyPinReset({ tgId }).catch(() => {});
  }
  res.json({ ok: true, tgId: tgId || null });
});

app.post('/api/pin-reset/complete', async (req, res) => {
  const { userId, pin } = req.body;
  await sql`UPDATE users SET pin = ${pin} WHERE id = ${userId}`;
  await sql`DELETE FROM pin_reset_requests WHERE user_id = ${userId}`;
  res.json({ ok: true });
});

app.get('/api/pin-reset/pending/:userId', async (req, res) => {
  const rows = await sql`SELECT * FROM pin_reset_requests WHERE user_id = ${req.params.userId} LIMIT 1`;
  res.json(rows[0] || null);
});

app.listen(PORT, () => {
  console.log(`KBPOST API on :${PORT}`);
});