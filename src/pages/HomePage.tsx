import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useToast, sendNotification } from '../context';
import { getUserParcels, updateParcelStatus, markParcelPaid } from '../db';
import { Parcel, STATUS_LABELS, STATUS_COLORS } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, Send, Inbox, ChevronRight,
  Truck, Clock, CheckCircle, CreditCard, X,
  Copy, Check, Archive
} from 'lucide-react';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month} ${hours}:${mins}`;
}

type FilterType = 'all' | 'sent' | 'received';

export default function HomePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showPayPopup, setShowPayPopup] = useState<Parcel | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedTTN, setCopiedTTN] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const allUserParcels = useMemo(() => {
    if (!user) return [];
    return getUserParcels(user.id);
    // eslint-disable-next-line
  }, [user, refreshKey]);

  const hasAnyParcels = allUserParcels.length > 0;
  const archivedParcels = allUserParcels.filter(p => p.status >= 7);
  const activeParcels = allUserParcels.filter(p => p.status < 7);

  const parcels = useMemo(() => {
    let list = showArchive ? archivedParcels : activeParcels;

    if (filter === 'sent') list = list.filter(p => p.senderId === user?.id);
    if (filter === 'received') list = list.filter(p => p.receiverId === user?.id);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        p =>
          p.description.toLowerCase().includes(q) ||
          p.senderUsername.toLowerCase().includes(q) ||
          p.receiverUsername.toLowerCase().includes(q) ||
          p.ttn.toLowerCase().includes(q) ||
          STATUS_LABELS[p.status]?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list;
    // eslint-disable-next-line
  }, [user, filter, search, refreshKey, showArchive, activeParcels, archivedParcels]);

  const handleCopyTTN = (ttn: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ttn).then(() => {
      setCopiedTTN(ttn);
      addToast(`ТТН ${ttn} скопирован`, 'info');
      setTimeout(() => setCopiedTTN(null), 2000);
    });
  };

  const handleMarkSent = (parcel: Parcel) => {
    updateParcelStatus(parcel.id, 2);
    sendNotification(`Посылка ${parcel.ttn} принята в отделении`);
    addToast('Статус обновлён: Приняли в отделении ✅', 'success');
    setRefreshKey(k => k + 1);
  };

  const handleMarkReceived = (parcel: Parcel) => {
    if (parcel.cashOnDelivery && !parcel.cashOnDeliveryConfirmed) {
      addToast('Сначала оплатите наложенный платёж', 'error');
      return;
    }
    updateParcelStatus(parcel.id, 7);
    sendNotification(`Посылка ${parcel.ttn} получена`);
    addToast('Посылка получена! 📦✅', 'success');
    setRefreshKey(k => k + 1);
  };

  const handlePay = (parcel: Parcel) => {
    setShowPayPopup(parcel);
  };

  const handleConfirmPay = () => {
    if (showPayPopup) {
      markParcelPaid(showPayPopup.id);
      sendNotification(`Оплата за посылку ${showPayPopup.ttn} отправлена на проверку`);
      addToast('Заявка на подтверждение оплаты отправлена! 💰', 'success');
      setShowPayPopup(null);
      setRefreshKey(k => k + 1);
    }
  };

  const isSender = (parcel: Parcel) => user?.id === parcel.senderId;
  const isReceiver = (parcel: Parcel) => user?.id === parcel.receiverId;

  const filterButtons: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Все', icon: <Package size={14} /> },
    { key: 'sent', label: 'Отправленные', icon: <Send size={14} /> },
    { key: 'received', label: 'Полученные', icon: <Inbox size={14} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Archive toggle */}
      {showArchive && (
        <button
          onClick={() => setShowArchive(false)}
          className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ChevronRight size={16} className="rotate-180" />
          Назад к посылкам
        </button>
      )}

      {showArchive && (
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Archive size={20} className="text-red-500" />
          Архив посылок
        </h2>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400 z-10" />
        <input
          type="text"
          className="input-dark input-with-icon pr-10"
          placeholder="Поиск по описанию, никнейму, ТТН..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/5 flex-1">
          {filterButtons.map(fb => (
            <button
              key={fb.key}
              onClick={() => setFilter(fb.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                filter === fb.key
                  ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              {fb.icon}
              <span className="hidden sm:inline">{fb.label}</span>
              <span className="sm:hidden">{fb.label.slice(0, 3)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Parcels list */}
      {parcels.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Package size={36} className="text-dark-400" />
          </div>
          <p className="text-dark-300 font-medium mb-1">
            {showArchive ? 'Архив пуст' : 'Посылок пока нет'}
          </p>
          <p className="text-dark-500 text-sm">
            {showArchive ? 'Завершённые посылки появятся здесь' : 'Создайте первую посылку!'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="sync">
            {parcels.map((parcel, index) => {
              const sender = isSender(parcel);
              const receiver = isReceiver(parcel);
              const otherUsername = sender ? parcel.receiverUsername : parcel.senderUsername;
              const statusColor = STATUS_COLORS[parcel.status] || '#6b7280';
              const lastStatusTime = parcel.statusHistory.length > 0
                ? formatDate(parcel.statusHistory[parcel.statusHistory.length - 1].timestamp)
                : formatDate(parcel.updatedAt);

              const showSentBtn = sender && parcel.status === 1 && !showArchive;
              const showReceivedBtn = receiver && parcel.status === 6 && !showArchive;
              const showPayBtn = receiver && parcel.cashOnDelivery && !parcel.cashOnDeliveryPaid && !parcel.cashOnDeliveryConfirmed && !showArchive;
              const isPaid = parcel.cashOnDelivery && parcel.cashOnDeliveryPaid && !parcel.cashOnDeliveryConfirmed;

              // COD badge показывается на месте кнопки когда кнопки нет
              const showCODInline = parcel.cashOnDelivery && !showPayBtn && !showSentBtn;

              return (
                <motion.div
                  key={parcel.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.03 }}
                  className="glass-card p-4"
                >
                  {/* Main row: avatar + info + status badge */}
                  <div className="flex items-start gap-3">
                    {/* Square avatar */}
                    <img
                      src={`https://mc-heads.net/avatar/${otherUsername}/48`}
                      alt={otherUsername}
                      className="w-12 h-12 rounded-xl ring-1 ring-white/10 flex-shrink-0 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${otherUsername}&background=dc2626&color=fff&size=48`;
                      }}
                    />

                    {/* Center info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Username + к/от */}
                      <p className="text-sm font-semibold text-white truncate leading-tight">
                        {sender ? `К ${otherUsername}` : `От ${otherUsername}`}
                      </p>

                      {/* TTN — prominent */}
                      <button
                        onClick={(e) => handleCopyTTN(parcel.ttn, e)}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-all group"
                      >
                        {copiedTTN === parcel.ttn
                          ? <Check size={10} className="text-green-400 flex-shrink-0" />
                          : <Copy size={10} className="text-dark-400 group-hover:text-red-400 flex-shrink-0 transition-colors" />
                        }
                        <span className="font-mono text-xs font-semibold text-dark-200 group-hover:text-white transition-colors tracking-wide">
                          {parcel.ttn}
                        </span>
                      </button>

                      {/* Description */}
                      <p className="text-xs text-dark-400 truncate leading-tight">{parcel.description}</p>
                    </div>

                    {/* Right: status badge + time */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{
                          color: statusColor,
                          borderColor: `${statusColor}40`,
                          backgroundColor: `${statusColor}15`,
                        }}
                      >
                        {STATUS_LABELS[parcel.status]}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-dark-500">
                        <Clock size={9} />
                        <span>{lastStatusTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* COD badge — показываем под инфо-строкой когда нет action-кнопки */}
                  {showCODInline && (
                    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg mt-3 ${
                      parcel.cashOnDeliveryConfirmed
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : parcel.cashOnDeliveryPaid
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    }`}>
                      <CreditCard size={12} />
                      <span>
                        Наложенный платёж: {parcel.cashOnDeliveryAmount} кбк
                        {parcel.cashOnDeliveryConfirmed && ' — Оплачено ✓'}
                        {isPaid && ' — На проверке'}
                      </span>
                    </div>
                  )}

                  {/* Action buttons row */}
                  <div className="flex items-center gap-2 mt-3">
                    {showSentBtn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkSent(parcel); }}
                        className="btn-primary btn-small flex-1"
                      >
                        <Truck size={14} />
                        Отправил
                      </button>
                    )}
                    {showPayBtn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePay(parcel); }}
                        className="btn-small flex-1 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 py-1.5 shadow-lg shadow-orange-500/20"
                      >
                        <CreditCard size={14} />
                        Оплатить
                      </button>
                    )}
                    {showReceivedBtn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkReceived(parcel); }}
                        className="btn-small flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 py-1.5 shadow-lg shadow-green-500/20"
                      >
                        <CheckCircle size={14} />
                        Забрал
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/parcel/${parcel.id}`)}
                      className="btn-secondary btn-small"
                    >
                      Подробнее
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Archive button — only if user has any parcels */}
      {hasAnyParcels && !showArchive && archivedParcels.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowArchive(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-dark-400 bg-white/5 border border-white/5 text-sm font-semibold hover:bg-white/10 hover:text-white transition-all"
        >
          <Archive size={16} />
          Архив посылок ({archivedParcels.length})
        </motion.button>
      )}

      {/* Payment popup */}
      <AnimatePresence>
        {showPayPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="popup-overlay"
            onClick={() => setShowPayPopup(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
              className="popup-content"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Оплата посылки</h3>
                <button onClick={() => setShowPayPopup(null)} className="text-dark-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="glass-card-static p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">ТТН</span>
                    <span className="text-sm font-mono font-semibold">{showPayPopup.ttn}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">Сумма к оплате</span>
                    <span className="text-lg font-bold text-orange-400">
                      {showPayPopup.cashOnDeliveryAmount} кбк
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">Счёт получателя</span>
                    <span className="text-sm font-semibold text-red-400">kbpost</span>
                  </div>
                </div>

                <div className="glass-card-static p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-white">📋 Инструкция по оплате:</h4>
                  <ol className="text-sm text-dark-300 space-y-1.5 list-decimal list-inside">
                    <li>Откройте банк-бота <a href="https://t.me/anorloxbot" target="_blank" rel="noopener noreferrer" className="text-red-400 font-medium underline">«анорлохбот»</a></li>
                    <li>Отправьте боту команду <span className="text-red-400 font-mono font-medium">/transfer</span></li>
                    <li>Переведите <span className="text-orange-400 font-semibold">{showPayPopup.cashOnDeliveryAmount} кбк</span> на счёт <span className="text-red-400 font-semibold">kbpost</span></li>
                    <li>После перевода нажмите кнопку <span className="text-green-400 font-medium">«Я оплатил»</span> ниже</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowPayPopup(null)} className="btn-secondary flex-1">
                    Отмена
                  </button>
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
