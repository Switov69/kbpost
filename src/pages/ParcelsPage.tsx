import { useState, useEffect, useCallback } from 'react';
import type { Parcel, UserProfile } from '../types';
import { getParcelsForUser } from '../api';
import { ParcelCard } from '../components/ParcelCard';
import { IconSearch, IconRefresh, IconPackage } from '../components/Icons';

interface ParcelsPageProps {
  user: UserProfile;
}

export function ParcelsPage({ user }: ParcelsPageProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getParcelsForUser(user.telegram_id);
      setParcels(data);
    } catch {
      setError('Не удалось загрузить посылки');
    } finally {
      setLoading(false);
    }
  }, [user.telegram_id]);

  useEffect(() => { load(); }, [load]);

  const filtered = parcels.filter(p => {
    const q = search.toLowerCase();
    return (
      p.ttn.toLowerCase().includes(q) ||
      p.sender_nickname.toLowerCase().includes(q) ||
      p.receiver_nickname.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.from_branch.toLowerCase().includes(q) ||
      p.to_branch.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-content">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Мои посылки</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {parcels.length} {parcels.length === 1 ? 'посылка' : parcels.length < 5 ? 'посылки' : 'посылок'}
            </p>
          </div>
          <button
            onClick={load}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <IconRefresh size={16} color="#80848e" />
          </button>
        </div>

        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <IconSearch size={16} color="#80848e" />
          </div>
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '36px' }}
            placeholder="Поиск по ТТН, никнейму, отделению..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4" style={{ height: '140px' }}>
                <div className="shimmer rounded-lg h-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p style={{ color: '#f04747' }}>{error}</p>
            <button onClick={load} className="btn-secondary mt-4 mx-auto" style={{ width: 'auto', padding: '10px 20px' }}>
              Повторить
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.15)' }}
            >
              <IconPackage size={28} color="#F5C518" />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {search ? 'Ничего не найдено' : 'Нет посылок'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'Попробуйте изменить запрос' : 'Создайте свою первую посылку'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && filtered.map(parcel => (
          <ParcelCard key={parcel.id} parcel={parcel} currentUserTelegramId={user.telegram_id} />
        ))}
      </div>
    </div>
  );
}
