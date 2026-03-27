import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getParcelById, getBranchById } from '../db';
import { STATUS_COLORS } from '../types';
import { motion } from 'framer-motion';
import { ArrowLeft, Route } from 'lucide-react';

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}, ${hours}:${mins}`;
}

function getStatusWithBranch(
  status: number,
  fromBranchId: string,
  toBranchId: string | null,
  toCoordinates: string | null
): string {
  if (status === 1) return 'Посылка оформлена';
  if (status === 2) {
    const branch = getBranchById(fromBranchId);
    return `Приняли в отделении ${branch ? branch.number : ''}`;
  }
  if (status === 3) {
    const branch = getBranchById(fromBranchId);
    return `Выехала из отделения ${branch ? branch.number : ''}`;
  }
  if (status === 4) return 'Прибыла в терминал';
  if (status === 5) return 'Выехала из терминала';
  if (status === 6) {
    if (toBranchId) {
      const branch = getBranchById(toBranchId);
      return `Прибыла в отделение ${branch ? branch.number : ''}`;
    }
    return 'Прибыла в отделение';
  }
  if (status === 7) {
    if (toBranchId) {
      const branch = getBranchById(toBranchId);
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
  toBranchId: string | null
): string {
  // Status 1, 2, 3 — from branch region + prefecture
  if (status === 1 || status === 2 || status === 3) {
    const branch = getBranchById(fromBranchId);
    if (branch) return `${branch.region}, ${branch.prefecture}`;
    return '';
  }
  // Status 4, 5 — terminal
  if (status === 4 || status === 5) {
    return 'Новый спавн';
  }
  // Status 6, 7 — to branch region + prefecture
  if (status === 6 || status === 7) {
    if (toBranchId) {
      const branch = getBranchById(toBranchId);
      if (branch) return `${branch.region}, ${branch.prefecture}`;
    }
    return '';
  }
  // Status 8 — coordinates are already in status text
  return '';
}

export default function RoutePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const parcel = useMemo(() => {
    if (!id) return null;
    return getParcelById(id);
  }, [id]);

  if (!parcel) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-dark-300">Посылка не найдена</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">На главную</button>
      </div>
    );
  }

  // Reverse the status history — latest on top
  const reversedHistory = [...parcel.statusHistory].reverse();

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
        <div className="space-y-0">
          {reversedHistory.map((entry, i) => {
            const isFirst = i === 0; // first in reversed = latest status
            const color = STATUS_COLORS[entry.status] || '#6b7280';
            const statusText = getStatusWithBranch(
              entry.status,
              parcel.fromBranchId,
              parcel.toBranchId,
              parcel.toCoordinates
            );
            const location = getStatusLocation(
              entry.status,
              parcel.fromBranchId,
              parcel.toBranchId
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
      </motion.div>
    </div>
  );
}
