// api/parcels/update.js — POST /api/parcels/update
// Обновляет статус или флаги оплаты посылки

const { getDB } = require('../_db');
const { getSessionUser, corsHeaders } = require('../_auth');

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

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Не авторизован' });

  const { parcelId, action, newStatus } = req.body || {};
  if (!parcelId) return res.status(400).json({ error: 'parcelId обязателен' });

  try {
    const sql = getDB();

    // Получаем посылку
    const rows = await sql`
      SELECT * FROM parcels WHERE id = ${parcelId}::uuid LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'Посылка не найдена' });
    const parcel = rows[0];

    // Проверяем права доступа
    const isSender   = parcel.sender_id   === session.userId;
    const isReceiver = parcel.receiver_id === session.userId;
    const isAdmin    = session.isAdmin;

    if (!isSender && !isReceiver && !isAdmin) {
      return res.status(403).json({ error: 'Нет доступа к этой посылке' });
    }

    let updated;

    // === Смена статуса ===
    if (action === 'updateStatus') {
      const ns = parseInt(newStatus, 10);
      if (!ns || !STATUS_LABELS[ns]) return res.status(400).json({ error: 'Неверный статус' });

      // Только отправитель может перевести в статус 2 (принята в отделении)
      if (ns === 2 && !isSender && !isAdmin) {
        return res.status(403).json({ error: 'Только отправитель может подтвердить отправку' });
      }
      // Статусы 3-6,8 — только admin
      if ([3, 4, 5, 6, 8].includes(ns) && !isAdmin) {
        return res.status(403).json({ error: 'Только администратор может менять этот статус' });
      }
      // Статус 7 (получено) — только получатель или admin
      if (ns === 7 && !isReceiver && !isAdmin) {
        return res.status(403).json({ error: 'Только получатель может подтвердить получение' });
      }
      // Нельзя получить если наложенный платёж не подтверждён
      if (ns === 7 && parcel.cash_on_delivery && !parcel.cash_on_delivery_confirmed) {
        return res.status(400).json({ error: 'Сначала оплатите наложенный платёж' });
      }

      const now = new Date().toISOString();
      const history = [...(parcel.status_history || []), { status: ns, label: STATUS_LABELS[ns], timestamp: now }];

      updated = await sql`
        UPDATE parcels
        SET status = ${ns},
            status_history = ${JSON.stringify(history)}::jsonb,
            updated_at = NOW()
        WHERE id = ${parcelId}::uuid
        RETURNING *
      `;
    }

    // === Пометить оплаченным (получатель нажал "Я оплатил") ===
    else if (action === 'markPaid') {
      if (!isReceiver && !isAdmin) {
        return res.status(403).json({ error: 'Только получатель может оплатить' });
      }
      updated = await sql`
        UPDATE parcels SET cash_on_delivery_paid = TRUE, updated_at = NOW()
        WHERE id = ${parcelId}::uuid
        RETURNING *
      `;
    }

    // === Подтвердить оплату (admin) ===
    else if (action === 'confirmPayment') {
      if (!isAdmin) return res.status(403).json({ error: 'Только администратор' });
      updated = await sql`
        UPDATE parcels SET cash_on_delivery_confirmed = TRUE, updated_at = NOW()
        WHERE id = ${parcelId}::uuid
        RETURNING *
      `;
    }

    // === Полное обновление данных (admin) ===
    else if (action === 'adminUpdate') {
      if (!isAdmin) return res.status(403).json({ error: 'Только администратор' });
      const { description, fromBranchId, toBranchId, toCoordinates } = req.body;
      updated = await sql`
        UPDATE parcels
        SET description    = COALESCE(${description ?? null}, description),
            from_branch_id = COALESCE(${fromBranchId ?? null}, from_branch_id),
            to_branch_id   = ${toBranchId ?? parcel.to_branch_id},
            to_coordinates = ${toCoordinates ?? parcel.to_coordinates},
            updated_at     = NOW()
        WHERE id = ${parcelId}::uuid
        RETURNING *
      `;
    }

    else {
      return res.status(400).json({ error: `Неизвестное действие: ${action}` });
    }

    const p = updated[0];
    return res.status(200).json({
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
    console.error('update parcel error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
