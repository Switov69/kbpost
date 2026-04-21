import type { Parcel } from '../types';
import { IconMapPin, IconTruck } from './Icons';

interface ParcelCardProps {
  parcel: Parcel;
  currentUserTelegramId: number;
}

const statusConfig: Record<Parcel['status'], { label: string; color: string; bg: string; dot: string }> = {
  pending: { label: 'Ожидает', color: '#F5C518', bg: 'rgba(245,197,24,0.12)', dot: '#F5C518' },
  in_transit: { label: 'В пути', color: '#5865F2', bg: 'rgba(88,101,242,0.12)', dot: '#5865F2' },
  delivered: { label: 'Доставлено', color: '#57f287', bg: 'rgba(87,242,135,0.12)', dot: '#57f287' },
  cancelled: { label: 'Отменено', color: '#f04747', bg: 'rgba(240,71,71,0.12)', dot: '#f04747' },
};

export function ParcelCard({ parcel, currentUserTelegramId }: ParcelCardProps) {
  const isSender = parcel.sender_id === currentUserTelegramId;
  const partnerNickname = isSender ? parcel.receiver_nickname : parcel.sender_nickname;
  const status = statusConfig[parcel.status];

  const dateStr = new Date(parcel.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="card p-4 fade-in" style={{ marginBottom: '10px' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)' }}
          >
            <IconTruck size={16} color="#F5C518" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base" style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {parcel.ttn}
              </span>
              <span
                className="status-badge"
                style={{ color: status.color, background: status.bg }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: status.dot }} />
                {status.label}
              </span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{dateStr}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            {isSender ? 'Получатель' : 'Отправитель'}
          </div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            @{partnerNickname}
          </div>
        </div>
      </div>

      <div className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
        {parcel.description}
      </div>

      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <IconMapPin size={12} color="#80848e" />
        <span>{parcel.from_branch}</span>
        <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
          <path d="M1 4h12M9 1l4 3-4 3" stroke="#80848e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>{parcel.to_branch}</span>
      </div>

      <div
        className="mt-3 pt-3 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isSender ? '📤 Вы отправили' : '📥 Вам отправили'}
        </span>
      </div>
    </div>
  );
}
