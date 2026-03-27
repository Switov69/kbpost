import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useToast, sendNotification } from '../context';
import { apiGetParcel, apiUpdateParcel, apiGetBranches, type ParcelDTO, type BranchDTO } from '../api';
import { STATUS_LABELS, STATUS_COLORS, getBranchDisplay } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Package, Truck, MapPin, CreditCard,
  CheckCircle, User, X, Copy, Check, Route, Loader
} from 'lucide-react';

function getBranchInfo(id: string | null, branches: BranchDTO[]): string {
  if (!id) return '—';
  const branch = branches.find(b => b.id === id);
  if (!branch) return id;
  const d = getBranchDisplay(branch);
  return `${d.line1}\n${d.line2}`;
}

export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [parcel, setParcel] = useState<ParcelDTO | null>(null);
  const [branches, setBranches] = useState<BranchDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPayPopup, setShowPayPopup] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      // Загружаем посылку и отделения параллельно
      // apiGetParcel(id) — тянет одну посылку со status_history (без загрузки всего списка)
      const [foundParcel, branchList] = await Promise.all([
        apiGetParcel(id),
        apiGetBranches(),
      ]);
      setParcel(foundParcel);
      setBranches(branchList);
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.message?.includes('не найдена')) {
        setParcel(null);
      } else {
        addToast('Не удалось загрузить данные', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={32} className="text-red-400 animate-spin" />
      </div>
    );
  }

  if (!parcel || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Package size={48} className="text-dark-400 mb-4" />
        <p className="text-dark-300">Посылка не найдена</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">
          На главную
        </button>
      </div>
    );
  }

  const isSender   = user.id === parcel.senderId;
  const isReceiver = user.id === parcel.receiverId;
  const otherUsername = isSender ? parcel.receiverUsername : parcel.senderUsername;

  const showSentBtn     = isSender   && parcel.status === 1;
  const showReceivedBtn = isReceiver && parcel.status === 6;
  const showPayBtn      = isReceiver && parcel.cashOnDelivery && !parcel.cashOnDeliveryPaid && !parcel.cashOnDeliveryConfirmed;

  const handleCopyTTN = () => {
    navigator.clipboard.writeText(parcel.ttn).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleMarkSent = async () => {
    try {
      const updated = await apiUpdateParcel(parcel.id, 'updateStatus', { newStatus: 2 });
      setParcel(updated);
      sendNotification(`Посылка ${parcel.ttn} принята в отделении`);
      addToast('Статус обновлён: Приняли в отделении ✅', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка', 'error');
    }
  };

  const handleMarkReceived = async () => {
    if (parcel.cashOnDelivery && !parcel.cashOnDeliveryConfirmed) {
      addToast('Сначала оплатите наложенный платёж', 'error');
      return;
    }
    try {
      const updated = await apiUpdateParcel(parcel.id, 'updateStatus', { newStatus: 7 });
      setParcel(updated);
      sendNotification(`Посылка ${parcel.ttn} получена`);
      addToast('Посылка получена! 📦✅', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка', 'error');
    }
  };

  const handleConfirmPay = async () => {
    try {
      const updated = await apiUpdateParcel(parcel.id, 'markPaid');
      setParcel(updated);
      sendNotification(`Оплата за посылку ${parcel.ttn} отправлена на проверку`);
      addToast('Заявка на подтверждение оплаты отправлена! 💰', 'success');
      setShowPayPopup(false);
    } catch (err: any) {
      addToast(err.message || 'Ошибка', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm font-medium"
      >
        <ArrowLeft size={18} />
        Назад
      </button>

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-static p-5"
      >
        {/* TTN */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono font-bold text-lg">{parcel.ttn}</span>
          <button onClick={handleCopyTTN} className="btn-secondary btn-small">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>

        {/* Sender/Receiver */}
        <div className="flex items-center gap-4 mb-4">
          <img
            src={`https://mc-heads.net/avatar/${otherUsername}/48`}
            alt={otherUsername}
            className="w-12 h-12 rounded-full ring-2 ring-white/10"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${otherUsername}&background=dc2626&color=fff&size=48`;
            }}
          />
          <div>
            <p className="text-sm text-dark-400">{isSender ? 'Получатель' : 'Отправитель'}</p>
            <p className="text-base font-bold">{otherUsername}</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[parcel.status], boxShadow: `0 0 8px ${STATUS_COLORS[parcel.status]}60` }}
          />
          <span className="text-sm font-semibold" style={{ color: STATUS_COLORS[parcel.status] }}>
            {STATUS_LABELS[parcel.status]}
          </span>
        </div>
      </motion.div>

      {/* Info card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card-static p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-dark-300 uppercase tracking-wider">Информация</h3>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Package size={16} className="text-dark-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Описание</p>
              <p className="text-sm text-white">{parcel.description}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-dark-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Откуда</p>
              <p className="text-sm text-white whitespace-pre-line">{getBranchInfo(parcel.fromBranchId, branches)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-dark-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Куда</p>
              <p className="text-sm text-white whitespace-pre-line">
                {parcel.toBranchId
                  ? getBranchInfo(parcel.toBranchId, branches)
                  : `Координаты: ${parcel.toCoordinates}`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User size={16} className="text-dark-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Отправитель</p>
              <p className="text-sm text-white">{parcel.senderUsername}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User size={16} className="text-dark-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Получатель</p>
              <p className="text-sm text-white">{parcel.receiverUsername}</p>
            </div>
          </div>

          {parcel.cashOnDelivery && (
            <div className="flex items-start gap-3">
              <CreditCard size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-dark-500">Наложенный платёж</p>
                <p className="text-sm font-semibold text-orange-400">{parcel.cashOnDeliveryAmount} кбк</p>
                <p className="text-xs mt-0.5">
                  {parcel.cashOnDeliveryConfirmed ? (
                    <span className="text-green-400">✓ Оплата подтверждена</span>
                  ) : parcel.cashOnDeliveryPaid ? (
                    <span className="text-yellow-400">⏳ Оплата на проверке</span>
                  ) : (
                    <span className="text-red-400">✗ Не оплачено</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Status history */}
      {parcel.statusHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card-static p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-dark-300 uppercase tracking-wider">История статусов</h3>
          <div className="space-y-2">
            {[...parcel.statusHistory].reverse().map((entry, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[entry.status] || '#6b7280' }}
                />
                <div className="flex-1 flex items-center justify-between gap-2">
                  <span className="text-sm" style={{ color: STATUS_COLORS[entry.status] || '#9ca3af' }}>
                    {entry.label}
                  </span>
                  <span className="text-xs text-dark-500 flex-shrink-0">
                    {new Date(entry.timestamp).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Route button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={() => navigate(`/parcel/${parcel.id}/route`)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/5 text-sm font-semibold hover:bg-white/10 transition-all text-white"
        >
          <Route size={16} className="text-red-500" />
          Маршрут посылки
        </button>
      </motion.div>

      {/* Action buttons */}
      {(showSentBtn || showReceivedBtn || showPayBtn) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2"
        >
          {showSentBtn && (
            <button onClick={handleMarkSent} className="btn-primary flex-1">
              <Truck size={18} />
              Отправил
            </button>
          )}
          {showPayBtn && (
            <button
              onClick={() => setShowPayPopup(true)}
              className="flex-1 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 py-3 shadow-lg shadow-orange-500/20"
            >
              <CreditCard size={18} />
              Оплатить
            </button>
          )}
          {showReceivedBtn && (
            <button
              onClick={handleMarkReceived}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 py-3 shadow-lg shadow-green-500/20"
            >
              <CheckCircle size={18} />
              Забрал
            </button>
          )}
        </motion.div>
      )}

      {/* Payment popup */}
      <AnimatePresence>
        {showPayPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="popup-overlay"
            onClick={() => setShowPayPopup(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="popup-content"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Оплата посылки</h3>
                <button onClick={() => setShowPayPopup(false)} className="text-dark-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="glass-card-static p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">ТТН</span>
                    <span className="text-sm font-mono font-semibold">{parcel.ttn}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">Сумма к оплате</span>
                    <span className="text-lg font-bold text-orange-400">{parcel.cashOnDeliveryAmount} кбк</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">Счёт получателя</span>
                    <span className="text-sm font-semibold text-red-400">kbpost</span>
                  </div>
                </div>
                <div className="glass-card-static p-4 space-y-2">
                  <h4 className="text-sm font-semibold">📋 Инструкция по оплате:</h4>
                  <ol className="text-sm text-dark-300 space-y-1.5 list-decimal list-inside">
                    <li>Откройте банк-бота <a href="https://t.me/anorloxbot" target="_blank" rel="noopener noreferrer" className="text-red-400 font-medium underline">«анорлохбот»</a></li>
                    <li>Отправьте боту команду <span className="text-red-400 font-mono font-medium">/transfer</span></li>
                    <li>Переведите <span className="text-orange-400 font-semibold">{parcel.cashOnDeliveryAmount} кбк</span> на счёт <span className="text-red-400 font-semibold">kbpost</span></li>
                    <li>После перевода нажмите кнопку <span className="text-green-400 font-medium">«Я оплатил»</span> ниже</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPayPopup(false)} className="btn-secondary flex-1">Отмена</button>
                  <button onClick={handleConfirmPay} className="btn-primary flex-1">
                    <CheckCircle size={16} />
                    Я оплатил
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
