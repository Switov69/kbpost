import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGetParcels, apiGetBranches, type ParcelDTO, type BranchDTO } from '../api';
import { STATUS_COLORS } from '../types';
import { motion } from 'framer-motion';
import { ArrowLeft, Route, Loader } from 'lucide-react';

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day   = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins  = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}, ${hours}:${mins}`;
}

function getStatusWithBranch(
  status: number,
  fromBranchId: string,
  toBranchId: string | null,
  toCoordinates: string | null,
  branches: BranchDTO[]
): string {
  const findBranch = (id: string) => branches.find(b => b.id === id);

  if (status === 1) return 'Посылка оформлена';
  if (status === 2) {
    const branch = findBranch(fromBranchId);
    return `Приняли в отделении ${branch ? branch.number : ''}`;
  }
  if (status === 3) {
    const branch = findBranch(fromBranchId);
    return `Выехала из отделения ${branch ? branch.number : ''}`;
  }
  if (status === 4) return 'Прибыла в терминал';
  if (status === 5) return 'Выехала из терминала';
  if (status === 6) {
    if (toBranchId) {
      const branch = findBranch(toBranchId);
      return `Прибыла в отделение ${branch ? branch.number : ''}`;
    }
    return 'Прибыла в отделение';
  }
  if (status === 7) {
    if (toBranchId) {
      const branch = findBranch(toBranchId);
      return `Получено в отделении ${branch ? branch.number : ''}`;
    }
    return 'Получено в отделении';
  }
  if (status === 8) {
    return `Доставлена на координаты ${toCoordinates || ''}`;
  }
  return '';
}

function getStatusLocation(
  status: number,
  fromBranchId: string,
  toBranchId: string | null,
  branches: BranchDTO[]
): string {
  const findBranch = (id: string) => branches.find(b => b.id === id);

  if (status === 1 || status === 2 || status === 3) {
    const branch = findBranch(fromBranchId);
    if (branch) return `${branch.region}, ${branch.prefecture}`;
    return '';
  }
  if (status === 4 || status === 5) {
    return 'Новый спавн';
  }
  if (status === 6 || status === 7) {
    if (toBranchId) {
      const branch = findBranch(toBranchId);
      if (branch) return `${branch.region}, ${branch.prefecture}`;
    }
    return '';
  }
  return '';
}

export default function RoutePage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [parcel, setParcel]     = useState<ParcelDTO | null>(null);
  const [branches, setBranches] = useState<BranchDTO[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      const [parcels, branchList] = await Promise.all([
        apiGetParcels(),
        apiGetBranches(),
      ]);
      const found = parcels.find(p => p.id === id) || null;
      setParcel(found);
      setBranches(branchList);
    } catch {
      setParcel(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={32} className="text-red-400 animate-spin" />
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-dark-300">Посылка не найдена</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">На главную</button>
      </div>
    );
  }

  // Защита от null/undefined — statusHistory может отсутствовать если сервер вернул старые данные
  const statusHistory = Array.isArray(parcel.statusHistory) ? parcel.statusHistory : [];
  const reversedHistory = [...statusHistory].reverse();

  return (
    <div className="space-y-4 pb-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm font-medium"
      >
        <ArrowLeft size={18} />
        Назад
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-static p-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Route size={18} className="text-red-500" />
          <h2 className="text-lg font-bold">Маршрут посылки</h2>
        </div>
        <p className="text-xs text-dark-400 font-mono">{parcel.ttn}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card-static p-5"
      >
        {reversedHistory.length === 0 ? (
          <p className="text-sm text-dark-400 text-center py-4">История маршрута пуста</p>
        ) : (
          <div className="space-y-0">
            {reversedHistory.map((entry, i) => {
              const isFirst = i === 0;
              const color = STATUS_COLORS[entry.status] || '#6b7280';
              const statusText = getStatusWithBranch(
                entry.status,
                parcel.fromBranchId,
                parcel.toBranchId,
                parcel.toCoordinates,
                branches
              );
              const location = getStatusLocation(
                entry.status,
                parcel.fromBranchId,
                parcel.toBranchId,
                branches
              );

              return (
                <div key={i} className="status-line pb-5">
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 6,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: isFirst ? color : `${color}50`,
                      border: `2px solid ${color}`,
                      boxShadow: isFirst ? `0 0 8px ${color}60` : 'none',
                    }}
                  />
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: isFirst ? color : '#a3a3a3' }}
                    >
                      {statusText}
                    </p>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {location ? `${location} • ` : ''}{formatDateShort(entry.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
