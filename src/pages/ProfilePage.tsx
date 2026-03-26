import { useState, useEffect } from 'react';
import { useAuth, useToast } from '../context';
import { apiGetParcels, apiGetProfile } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Eye, EyeOff, LogOut, Save, Shield, Globe,
  CreditCard, Send, Inbox, Package, Calendar, Wallet, KeyRound
} from 'lucide-react';

const TelegramIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [stats, setStats] = useState({ sent: 0, received: 0, active: 0 });

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [changingAccount, setChangingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Загружаем статистику
  useEffect(() => {
    if (!user) return;
    apiGetParcels()
      .then(parcels => {
        const userParcels = parcels.filter(p => p.senderId === user.id || p.receiverId === user.id);
        setStats({
          sent:     userParcels.filter(p => p.senderId === user.id).length,
          received: userParcels.filter(p => p.receiverId === user.id).length,
          active:   userParcels.filter(p => p.status < 7).length,
        });
      })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      addToast('Новый пароль должен быть от 4 символов', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Пароли не совпадают', 'error');
      return;
    }
    // Смена пароля: пробуем через /api/user/change-password
    setSavingPassword(true);
    try {
      const { getToken } = await import('../api');
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
      addToast('Пароль успешно изменён! 🔒', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка смены пароля', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleChangeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.trim()) {
      addToast('Введите название счёта', 'error');
      return;
    }
    if (newAccount.trim() === user.account) {
      addToast('Новый счёт не может совпадать с текущим', 'error');
      return;
    }
    setSavingAccount(true);
    try {
      const { getToken } = await import('../api');
      const res = await fetch('/api/user/update-account', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ account: newAccount.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      await refreshUser();
      setNewAccount('');
      setChangingAccount(false);
      addToast('Счёт успешно изменён! 💳', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка смены счёта', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-static p-6 flex flex-col items-center text-center"
      >
        <div className="relative mb-4">
          <img
            src={`https://mc-heads.net/avatar/${user.username}/80`}
            alt={user.username}
            className="w-20 h-20 rounded-2xl ring-4 ring-red-500/20 shadow-2xl shadow-red-500/10"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.username}&background=dc2626&color=fff&size=80`;
            }}
          />
          {user.isAdmin && (
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg">
              <Shield size={14} className="text-white" />
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold">{user.username}</h2>
        <p className="text-sm text-dark-400 flex items-center gap-1.5 mt-1">
          <TelegramIcon size={14} />
          {user.telegramUsername || '—'}
        </p>
        {user.isAdmin && (
          <span className="mt-2 text-xs font-semibold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
            Администратор
          </span>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-2"
      >
        {[
          { icon: <Send size={16} />,    label: 'Отправлено', value: stats.sent,     color: 'text-blue-400' },
          { icon: <Inbox size={16} />,   label: 'Получено',   value: stats.received,  color: 'text-green-400' },
          { icon: <Package size={16} />, label: 'Активных',   value: stats.active,    color: 'text-orange-400' },
        ].map((stat, i) => (
          <div key={i} className="glass-card-static p-3 text-center">
            <div className={`flex justify-center mb-1.5 ${stat.color}`}>{stat.icon}</div>
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-[10px] text-dark-400 font-medium">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card-static p-5 space-y-3"
      >
        <h3 className="text-sm font-bold text-dark-300 uppercase tracking-wider">Информация</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Globe size={16} className="text-dark-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Гражданство</p>
              <p className="text-sm font-medium">{user.citizenship}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CreditCard size={16} className="text-dark-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Счёт</p>
              <p className="text-sm font-medium">{user.account}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-dark-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-dark-500">Дата регистрации</p>
              <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Change password */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card-static p-5 overflow-hidden"
      >
        <button
          onClick={() => setChangingPassword(!changingPassword)}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Lock size={18} className="text-dark-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Изменить пароль</p>
            <p className="text-xs text-dark-500">Обновите пароль от аккаунта</p>
          </div>
        </button>

        <AnimatePresence>
          {changingPassword && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              onSubmit={handleChangePassword}
              className="space-y-3 overflow-hidden mt-4 pt-4 border-t border-white/5"
            >
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1">Текущий пароль</label>
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    className="input-dark pr-10 text-sm"
                    placeholder="Введите текущий пароль"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                    {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1">Новый пароль</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    className="input-dark pr-10 text-sm"
                    placeholder="Минимум 4 символа"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1">Повторите пароль</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    className="input-dark pr-10 text-sm"
                    placeholder="Повторите новый пароль"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setChangingPassword(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  className="btn-secondary flex-1 text-sm"
                >
                  Отмена
                </button>
                <button type="submit" disabled={savingPassword} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  <Save size={14} />
                  {savingPassword ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Change account */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
        className="glass-card-static p-5 overflow-hidden"
      >
        <button
          onClick={() => { setChangingAccount(!changingAccount); setNewAccount(''); }}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Wallet size={18} className="text-dark-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Изменить счёт</p>
            <p className="text-xs text-dark-500">Текущий: {user.account}</p>
          </div>
        </button>
        <AnimatePresence>
          {changingAccount && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              onSubmit={handleChangeAccount}
              className="space-y-3 overflow-hidden mt-4 pt-4 border-t border-white/5"
            >
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1">Новый счёт</label>
                <input
                  type="text"
                  className="input-dark text-sm"
                  placeholder="Введите название нового счёта"
                  value={newAccount}
                  onChange={e => setNewAccount(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setChangingAccount(false); setNewAccount(''); }} className="btn-secondary flex-1 text-sm">
                  Отмена
                </button>
                <button type="submit" disabled={savingAccount} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  <Save size={14} />
                  {savingAccount ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Reset password via bot */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }}>
        <button
          type="button"
          onClick={() => {
            window.open(`https://t.me/kbpostbot?start=reset_${encodeURIComponent(user.username)}`, '_blank', 'noopener,noreferrer');
          }}
          className="w-full flex items-center gap-3 p-5 glass-card-static text-left hover:bg-white/[0.06] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <KeyRound size={18} className="text-dark-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Сбросить пароль</p>
            <p className="text-xs text-dark-500">Через Telegram бота</p>
          </div>
        </button>
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-400 bg-red-500/10 border border-red-500/20 text-sm font-semibold hover:bg-red-500/15 transition-colors"
        >
          <LogOut size={16} />
          Выйти из аккаунта
        </button>
      </motion.div>
    </div>
  );
}
