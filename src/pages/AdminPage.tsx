import { useState, useEffect, useCallback } from 'react';
import { useAuth, useToast, sendNotification } from '../context';
import {
  apiGetAllUsers, apiGetParcels, apiManageUser,
  apiUpdateParcel, apiDeleteParcel,
  apiGetBranches, apiManageBranch,
  type UserDTO, type ParcelDTO, type BranchDTO,
} from '../api';
import { STATUS_LABELS, STATUS_COLORS, getBranchDisplay } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Package, Shield, CreditCard, Search, Trash2,
  ChevronDown, ChevronUp, CheckCircle,
  UserPlus, AlertCircle, RefreshCw, MapPin, Plus, Edit3, Save, X, Loader
} from 'lucide-react';

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function getBranchInfo(id: string | null, branches: BranchDTO[]): string {
  if (!id) return '—';
  const b = branches.find(b => b.id === id);
  if (!b) return id;
  const d = getBranchDisplay(b);
  return `${d.line1} — ${d.line2}`;
}

const TelegramIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

type Tab = 'users' | 'parcels' | 'admins' | 'payments' | 'branches';

export default function AdminPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('parcels');
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers]     = useState<UserDTO[]>([]);
  const [allParcels, setAllParcels] = useState<ParcelDTO[]>([]);
  const [allBranches, setAllBranches] = useState<BranchDTO[]>([]);

  const [ttnSearch, setTtnSearch] = useState('');
  const [expandedParcel, setExpandedParcel] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [newAdminUsername, setNewAdminUsername] = useState('');

  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchDTO | null>(null);
  const [branchNumber, setBranchNumber] = useState('');
  const [branchRegion, setBranchRegion] = useState('Столица');
  const [branchPrefecture, setBranchPrefecture] = useState('');
  const [branchAddress, setBranchAddress] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [users, parcels, branches] = await Promise.all([
        apiGetAllUsers(), apiGetParcels(), apiGetBranches(),
      ]);
      setAllUsers(users);
      setAllParcels(parcels);
      setAllBranches(branches);
    } catch (err: any) {
      addToast(err.message || 'Ошибка загрузки', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield size={48} className="text-dark-400 mb-4" />
        <p className="text-dark-300">Доступ запрещён</p>
      </div>
    );
  }

  const filteredParcels = allParcels
    .filter(p => {
      if (!ttnSearch.trim()) return true;
      const q = ttnSearch.toLowerCase();
      return p.ttn.toLowerCase().includes(q) || p.senderUsername.toLowerCase().includes(q) ||
             p.receiverUsername.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const paymentRequests = allParcels.filter(p => p.cashOnDelivery && p.cashOnDeliveryPaid && !p.cashOnDeliveryConfirmed);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'parcels',  label: 'Посылки',   icon: <Package size={14} /> },
    { key: 'users',    label: 'Юзеры',     icon: <Users size={14} /> },
    { key: 'admins',   label: 'Админы',    icon: <Shield size={14} /> },
    { key: 'payments', label: 'Оплата',    icon: <CreditCard size={14} />, badge: paymentRequests.length },
    { key: 'branches', label: 'Отделения', icon: <MapPin size={14} /> },
  ];

  const handleStatusChange = async (parcelId: string, newStatus: number) => {
    try {
      const updated = await apiUpdateParcel(parcelId, 'updateStatus', { newStatus });
      setAllParcels(prev => prev.map(p => p.id === updated.id ? updated : p));
      sendNotification(`Статус посылки изменён: ${STATUS_LABELS[newStatus]}`);
      addToast(`Статус обновлён: ${STATUS_LABELS[newStatus]}`, 'success');
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const handleDeleteParcel = async (parcelId: string) => {
    try {
      await apiDeleteParcel(parcelId);
      setAllParcels(prev => prev.filter(p => p.id !== parcelId));
      addToast('Посылка удалена', 'success');
      setDeleteConfirm(null);
      setExpandedParcel(null);
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const handleConfirmPayment = async (parcelId: string) => {
    try {
      const updated = await apiUpdateParcel(parcelId, 'confirmPayment');
      setAllParcels(prev => prev.map(p => p.id === updated.id ? updated : p));
      sendNotification('Оплата посылки подтверждена');
      addToast('Оплата подтверждена ✅', 'success');
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const handleAddAdmin = async () => {
    if (!newAdminUsername.trim()) { addToast('Введите никнейм', 'error'); return; }
    const found = allUsers.find(u => u.username.toLowerCase() === newAdminUsername.trim().toLowerCase());
    if (!found) { addToast('Пользователь не найден', 'error'); return; }
    if (found.isAdmin) { addToast('Уже является админом', 'error'); return; }
    try {
      await apiManageUser('makeAdmin', found.id);
      setAllUsers(prev => prev.map(u => u.id === found.id ? { ...u, isAdmin: true } : u));
      addToast(`${found.username} назначен администратором`, 'success');
      setNewAdminUsername('');
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (userId === user.id) { addToast('Нельзя снять себя с админки', 'error'); return; }
    try {
      await apiManageUser('removeAdmin', userId);
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin: false } : u));
      addToast('Администратор снят', 'success');
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Удалить пользователя "${username}"?`)) return;
    try {
      await apiManageUser('delete', userId);
      setAllUsers(prev => prev.filter(u => u.id !== userId));
      setExpandedUser(null);
      addToast(`Пользователь ${username} удалён`, 'success');
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const resetBranchForm = () => {
    setShowBranchForm(false); setEditingBranch(null);
    setBranchNumber(''); setBranchRegion('Столица'); setBranchPrefecture(''); setBranchAddress('');
  };

  const startEditBranch = (b: BranchDTO) => {
    setEditingBranch(b); setBranchNumber(String(b.number)); setBranchRegion(b.region);
    setBranchPrefecture(b.prefecture); setBranchAddress(b.address); setShowBranchForm(true);
  };

  const handleSaveBranch = async () => {
    if (!branchNumber.trim() || !branchPrefecture.trim()) { addToast('Заполните все поля', 'error'); return; }
    const num = parseInt(branchNumber);
    if (isNaN(num) || num < 1) { addToast('Некорректный номер', 'error'); return; }
    try {
      if (editingBranch) {
        const updated = await apiManageBranch('update', { id: editingBranch.id, number: num, region: branchRegion, prefecture: branchPrefecture, address: branchAddress }) as BranchDTO;
        setAllBranches(prev => prev.map(b => b.id === updated.id ? updated : b));
        addToast('Отделение обновлено', 'success');
      } else {
        const created = await apiManageBranch('create', { number: num, region: branchRegion, prefecture: branchPrefecture, address: branchAddress }) as BranchDTO;
        setAllBranches(prev => [...prev, created]);
        addToast('Отделение создано', 'success');
      }
      resetBranchForm();
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const handleDeleteBranch = async (id: string) => {
    try {
      await apiManageBranch('delete', { id });
      setAllBranches(prev => prev.filter(b => b.id !== id));
      addToast('Отделение удалено', 'success');
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Shield size={20} className="text-red-500" />Админ-панель
        </h1>
        <button onClick={fetchAll} className="btn-secondary btn-small" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/5 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 whitespace-nowrap px-1.5 ${activeTab === tab.key ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20' : 'text-dark-400 hover:text-white'}`}>
            {tab.icon}{tab.label}
            {tab.badge && tab.badge > 0 ? <span className="ml-0.5 w-4 h-4 rounded-full bg-orange-500 text-[10px] flex items-center justify-center text-white font-bold">{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader size={28} className="text-red-400 animate-spin" /></div>}

      {!loading && (
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

            {/* PARCELS */}
            {activeTab === 'parcels' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400 z-10" />
                  <input type="text" className="input-dark input-with-icon text-sm" placeholder="Поиск по ТТН, описанию, никнейму..." value={ttnSearch} onChange={e => setTtnSearch(e.target.value)} />
                </div>
                <p className="text-xs text-dark-500">Всего посылок: {filteredParcels.length}</p>
                {filteredParcels.map(parcel => {
                  const isExpanded = expandedParcel === parcel.id;
                  const isDeleting = deleteConfirm === parcel.id;
                  const getNextStatus = (): number | null => {
                    const s = parcel.status;
                    if (s === 2) return 3; if (s === 3) return 4; if (s === 4) return 5;
                    if (s === 5) return parcel.toCoordinates && !parcel.toBranchId ? 8 : 6;
                    return null;
                  };
                  const nextStatus = getNextStatus();
                  return (
                    <div key={parcel.id} className="glass-card-static overflow-hidden">
                      <button onClick={() => setExpandedParcel(isExpanded ? null : parcel.id)} className="w-full p-4 text-left flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1"><span className="text-xs font-mono font-semibold text-red-400">{parcel.ttn}</span></div>
                          <p className="text-sm text-dark-200 truncate">{parcel.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[parcel.status] }} />
                            <span className="text-[11px]" style={{ color: STATUS_COLORS[parcel.status] }}>{STATUS_LABELS[parcel.status]}</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-dark-500">Отправитель:</span><p className="font-medium">{parcel.senderUsername}</p></div>
                                <div><span className="text-dark-500">Получатель:</span><p className="font-medium">{parcel.receiverUsername}</p></div>
                                <div><span className="text-dark-500">Откуда:</span><p className="font-medium">{getBranchInfo(parcel.fromBranchId, allBranches)}</p></div>
                                <div><span className="text-dark-500">Куда:</span><p className="font-medium">{parcel.toBranchId ? getBranchInfo(parcel.toBranchId, allBranches) : parcel.toCoordinates}</p></div>
                                <div><span className="text-dark-500">Создана:</span><p className="font-medium">{formatDate(parcel.createdAt)}</p></div>
                              </div>
                              {parcel.cashOnDelivery && (
                                <div className="text-xs p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                                  💰 Наложенный платёж: {parcel.cashOnDeliveryAmount} кбк
                                  {parcel.cashOnDeliveryConfirmed && ' ✅ Подтверждено'}
                                  {parcel.cashOnDeliveryPaid && !parcel.cashOnDeliveryConfirmed && ' ⏳ На проверке'}
                                </div>
                              )}
                              <div className="text-xs space-y-1">
                                <p className="text-dark-500 font-semibold">Маршрут:</p>
                                {parcel.statusHistory.map((entry, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.status] }} />
                                    <span className="text-dark-300">{entry.label}</span>
                                    <span className="text-dark-500 ml-auto">{formatDate(entry.timestamp)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                {nextStatus ? (
                                  <button onClick={() => handleStatusChange(parcel.id, nextStatus)} className="btn-secondary btn-small flex-1 text-xs flex items-center justify-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[nextStatus] }} />
                                    {STATUS_LABELS[nextStatus]}
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-dark-500 flex items-center flex-1 justify-center py-1">{parcel.status >= 7 ? '✓ Завершена' : 'Ожидание действия'}</span>
                                )}
                                {parcel.cashOnDelivery && parcel.cashOnDeliveryPaid && !parcel.cashOnDeliveryConfirmed && (
                                  <button onClick={() => handleConfirmPayment(parcel.id)} className="btn-small flex-1 text-xs bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1">
                                    <CheckCircle size={12} />Оплата
                                  </button>
                                )}
                                {isDeleting ? (
                                  <div className="flex gap-1">
                                    <button onClick={() => handleDeleteParcel(parcel.id)} className="btn-small text-xs bg-red-600 text-white rounded-lg font-semibold px-3">Да</button>
                                    <button onClick={() => setDeleteConfirm(null)} className="btn-secondary btn-small text-xs">Нет</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirm(parcel.id)} className="btn-small text-xs bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 flex items-center gap-1 px-3"><Trash2 size={12} /></button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {filteredParcels.length === 0 && <div className="text-center py-8 text-dark-400 text-sm">Посылок не найдено</div>}
              </div>
            )}

            {/* USERS */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                <p className="text-xs text-dark-500">Всего пользователей: {allUsers.length}</p>
                {allUsers.map(u => {
                  const isExp = expandedUser === u.id;
                  const up = allParcels.filter(p => p.senderId === u.id || p.receiverId === u.id);
                  return (
                    <div key={u.id} className="glass-card-static overflow-hidden">
                      <button onClick={() => setExpandedUser(isExp ? null : u.id)} className="w-full p-4 text-left flex items-center gap-3">
                        <img src={`https://mc-heads.net/avatar/${u.username}/36`} alt={u.username} className="w-9 h-9 rounded-full ring-2 ring-white/10" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${u.username}&background=dc2626&color=fff&size=36`; }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{u.username}</p>
                            {u.isAdmin && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">ADMIN</span>}
                          </div>
                          <p className="text-xs text-dark-400 flex items-center gap-1"><TelegramIcon size={10} /> {u.telegramId ? `@${u.telegramId}` : '—'}</p>
                        </div>
                        {isExp ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                      </button>
                      <AnimatePresence>
                        {isExp && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white/5 rounded-lg p-2"><span className="text-dark-500">Гражданство:</span><p className="font-medium">{u.citizenship}</p></div>
                                <div className="bg-white/5 rounded-lg p-2"><span className="text-dark-500">Счёт:</span><p className="font-medium">{u.account}</p></div>
                                <div className="bg-white/5 rounded-lg p-2"><span className="text-dark-500">Отправлено:</span><p className="font-medium">{up.filter(p => p.senderId === u.id).length}</p></div>
                                <div className="bg-white/5 rounded-lg p-2"><span className="text-dark-500">Получено:</span><p className="font-medium">{up.filter(p => p.receiverId === u.id).length}</p></div>
                                <div className="bg-white/5 rounded-lg p-2"><span className="text-dark-500">Активных:</span><p className="font-medium">{up.filter(p => p.status < 7).length}</p></div>
                              </div>
                              <p className="text-[10px] text-dark-500">Регистрация: {formatDate(u.createdAt || '')}</p>
                              {!u.isAdmin && u.id !== user.id && (
                                <button onClick={() => handleDeleteUser(u.id, u.username)} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors mt-1">
                                  <Trash2 size={13} />Удалить пользователя
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ADMINS */}
            {activeTab === 'admins' && (
              <div className="space-y-4">
                <div className="glass-card-static p-4 space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2"><UserPlus size={16} className="text-red-500" />Добавить администратора</h3>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Никнейм</label>
                    <input type="text" className="input-dark text-sm" placeholder="Никнейм пользователя" value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAdmin()} />
                  </div>
                  <button onClick={handleAddAdmin} className="btn-primary w-full text-sm"><UserPlus size={14} />Назначить админом</button>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-dark-300">Текущие администраторы</h3>
                  {allUsers.filter(u => u.isAdmin).map(admin => (
                    <div key={admin.id} className="glass-card-static p-3 flex items-center gap-3">
                      <img src={`https://mc-heads.net/avatar/${admin.username}/32`} alt={admin.username} className="w-8 h-8 rounded-full ring-2 ring-red-500/20" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${admin.username}&background=dc2626&color=fff&size=32`; }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{admin.username}</p>
                        <p className="text-xs text-dark-400 flex items-center gap-1"><TelegramIcon size={10} /> {admin.telegramId ? `@${admin.telegramId}` : '—'}</p>
                      </div>
                      {admin.id !== user.id && (
                        <button onClick={() => handleRemoveAdmin(admin.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg bg-red-500/10">Снять</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PAYMENTS */}
            {activeTab === 'payments' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-dark-300">Заявки на подтверждение оплаты</h3>
                {paymentRequests.length === 0 ? (
                  <div className="text-center py-8 glass-card-static">
                    <CheckCircle size={32} className="text-dark-400 mx-auto mb-2" />
                    <p className="text-sm text-dark-400">Нет заявок на подтверждение</p>
                  </div>
                ) : paymentRequests.map(parcel => (
                  <div key={parcel.id} className="glass-card-static p-4 space-y-3">
                    <div className="flex items-center gap-2"><span className="text-xs font-mono font-semibold text-red-400">{parcel.ttn}</span></div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-dark-500">Отправитель:</span><p className="font-medium">{parcel.senderUsername}</p></div>
                      <div><span className="text-dark-500">Получатель:</span><p className="font-medium">{parcel.receiverUsername}</p></div>
                    </div>
                    <div className="flex items-center justify-between bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                      <div><p className="text-xs text-dark-400">Сумма</p><p className="text-lg font-bold text-orange-400">{parcel.cashOnDeliveryAmount} кбк</p></div>
                      <div className="flex items-center gap-1 text-xs text-yellow-400"><AlertCircle size={14} />Ожидает проверки</div>
                    </div>
                    <p className="text-xs text-dark-400">Проверьте поступление средств на счёт <span className="text-red-400 font-semibold">kbpost</span>, затем переведите отправителю и подтвердите оплату.</p>
                    <button onClick={() => handleConfirmPayment(parcel.id)} className="btn-primary w-full text-sm"><CheckCircle size={14} />Подтвердить оплату</button>
                  </div>
                ))}
              </div>
            )}

            {/* BRANCHES */}
            {activeTab === 'branches' && (
              <div className="space-y-4">
                <AnimatePresence>
                  {showBranchForm ? (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-card-static p-4 space-y-3 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold flex items-center gap-2">{editingBranch ? <Edit3 size={16} className="text-red-500" /> : <Plus size={16} className="text-red-500" />}{editingBranch ? 'Редактировать отделение' : 'Новое отделение'}</h3>
                        <button onClick={resetBranchForm} className="text-dark-400 hover:text-white"><X size={16} /></button>
                      </div>
                      <div><label className="block text-xs text-dark-400 mb-1">Номер</label><input type="text" className="input-dark text-sm" placeholder="Номер" value={branchNumber} onChange={e => setBranchNumber(e.target.value.replace(/[^0-9]/g, ''))} /></div>
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Регион</label>
                        <div className="flex gap-2">
                          {['Столица', 'Антегрия'].map(r => <button key={r} onClick={() => setBranchRegion(r)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${branchRegion === r ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg' : 'bg-white/5 border border-white/10 text-dark-400 hover:text-white'}`}>{r}</button>)}
                        </div>
                      </div>
                      <div><label className="block text-xs text-dark-400 mb-1">{branchRegion === 'Столица' ? 'Префектура' : 'Губерния'}</label><input type="text" className="input-dark text-sm" value={branchPrefecture} onChange={e => setBranchPrefecture(e.target.value)} /></div>
                      <div><label className="block text-xs text-dark-400 mb-1">Адрес</label><input type="text" className="input-dark text-sm" value={branchAddress} onChange={e => setBranchAddress(e.target.value)} /></div>
                      <button onClick={handleSaveBranch} className="btn-primary w-full text-sm"><Save size={14} />{editingBranch ? 'Сохранить' : 'Создать'}</button>
                    </motion.div>
                  ) : (
                    <button onClick={() => setShowBranchForm(true)} className="btn-primary w-full text-sm"><Plus size={14} />Добавить отделение</button>
                  )}
                </AnimatePresence>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-dark-300">Текущие отделения</h3>
                  {allBranches.map(branch => {
                    const display = getBranchDisplay(branch);
                    return (
                      <div key={branch.id} className="glass-card-static p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center text-base font-bold text-red-400">{branch.number}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{display.line1}</p><p className="text-xs text-dark-400">{display.line2}</p></div>
                          <div className="flex gap-1.5">
                            <button onClick={() => startEditBranch(branch)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-dark-400 hover:text-white"><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteBranch(branch.id)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {allBranches.length === 0 && <div className="text-center py-8 text-dark-400 text-sm">Нет отделений</div>}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
