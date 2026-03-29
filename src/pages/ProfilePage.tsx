import { useState, useEffect, useRef } from 'react';
import { useAuth, useToast } from '../context';
import { apiGetParcels, apiChangePassword, apiUpdateAccount, apiRequestSubscription } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Eye, EyeOff, LogOut, Save, Shield, Globe,
  CreditCard, Send, Inbox, Package, Calendar, Wallet, KeyRound,
  Star, X, CheckCircle
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

function daysLeft(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Компонент звёздочек ───────────────────────────────────────────────────
interface StarParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
  size: number;
  duration: number;
}

function StarParticles({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<StarParticle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    // Генерируем 8 частиц — немного, не перегружая интерфейс
    const ps: StarParticle[] = Array.from({ length: 8 }, (_, i) => ({
      id:       Date.now() + i,
      x:        Math.random() * 100,   // % от ширины родителя
      y:        Math.random() * 100,
      angle:    Math.random() * 360,
      distance: 30 + Math.random() * 40, // px разлёта
      size:     8 + Math.random() * 8,
      duration: 1.5 + Math.random() * 1,  // секунды
    }));
    setParticles(ps);

    // Убираем частицы после анимации
    timerRef.current = setTimeout(() => setParticles([]), 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active]);

  if (!particles.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 1, x: `${p.x}%`, y: `${p.y}%` }}
          animate={{
            opacity: 0,
            scale: 0.4,
            x: `calc(${p.x}% + ${Math.cos((p.angle * Math.PI) / 180) * p.distance}px)`,
            y: `calc(${p.y}% + ${Math.sin((p.angle * Math.PI) / 180) * p.distance}px)`,
          }}
          transition={{ duration: p.duration, ease: 'easeOut' }}
          style={{ position: 'absolute', fontSize: p.size, lineHeight: 1 }}
        >
          ⭐
        </motion.div>
      ))}
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [stats, setStats] = useState({ sent: 0, received: 0, active: 0 });

  const [oldPassword, setOldPassword]       = useState('');
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass]       = useState(false);
  const [showNewPass, setShowNewPass]       = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [changingAccount, setChangingAccount] = useState(false);
  const [newAccount, setNewAccount]           = useState('');
  const [savingAccount, setSavingAccount]     = useState(false);

  // Подписка
  const [showSubPopup, setShowSubPopup]         = useState(false);
  const [showSubInfoPopup, setShowSubInfoPopup] = useState(false);
  const [sendingSubRequest, setSendingSubRequest] = useState(false);
  const [starsActive, setStarsActive]           = useState(false);

  // Запускаем звёздочки однократно при монтировании если подписка активна
  useEffect(() => {
    if (user?.subscriptionActive) {
      setStarsActive(true);
      const t = setTimeout(() => setStarsActive(false), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    apiGetParcels()
      .then(parcels => {
        const up = parcels.filter(p => p.senderId === user.id || p.receiverId === user.id);
        setStats({
          sent:     up.filter(p => p.senderId === user.id).length,
          received: up.filter(p => p.receiverId === user.id).length,
          active:   up.filter(p => p.status < 7).length,
        });
      })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4)           { addToast('Новый пароль должен быть от 4 символов', 'error'); return; }
    if (newPassword !== confirmPassword)  { addToast('Пароли не совпадают', 'error'); return; }
    setSavingPassword(true);
    try {
      await apiChangePassword(oldPassword, newPassword);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
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
    if (!newAccount.trim())                       { addToast('Введите название счёта', 'error'); return; }
    if (newAccount.trim() === user.account)       { addToast('Новый счёт совпадает с текущим', 'error'); return; }
    setSavingAccount(true);
    try {
      await apiUpdateAccount(newAccount.trim());
      await refreshUser();
      setNewAccount(''); setChangingAccount(false);
      addToast('Счёт успешно изменён! 💳', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка смены счёта', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSubscriptionPay = async () => {
    setSendingSubRequest(true);
    try {
      await apiRequestSubscription();
      setShowSubPopup(false);
      addToast('Запрос отправлен! Ожидайте подтверждения администратором 💰', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка отправки запроса', 'error');
    } finally {
      setSendingSubRequest(false);
    }
  };

  const subExpires = user.subscriptionExpires ? new Date(user.subscriptionExpires) : null;
  const subDaysLeft = subExpires ? daysLeft(subExpires.toISOString()) : 0;

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
              (e.target as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${user.username}&background=dc2626&color=fff&size=80`;
            }}
          />
          {user.isAdmin && (
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg">
              <Shield size={14} className="text-white" />
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold">{user.username}</h2>

        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {user.isAdmin && (
            <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              Администратор
            </span>
          )}
          {user.subscriptionActive && (
            <span className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 flex items-center gap-1">
              <Star size={11} />
              Подписка активна
            </span>
          )}
        </div>

        {/* Карточка «Подписка активна» со звёздочками — кликабельна */}
        {user.subscriptionActive ? (
          <motion.button
            onClick={() => setShowSubInfoPopup(true)}
            whileTap={{ scale: 0.97 }}
            className="relative mt-3 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-yellow-600/30 to-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-sm font-semibold overflow-hidden cursor-pointer"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <StarParticles active={starsActive} />
            <Star size={15} className="text-yellow-400 flex-shrink-0" />
            Подписка активна
          </motion.button>
        ) : (
          /* Кнопка «Купить подписку» — hover только scale, без изменения цвета */
          <motion.button
            onClick={() => setShowSubPopup(true)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-600/80 to-yellow-500/80 text-white text-sm font-semibold shadow-lg shadow-yellow-500/20"
          >
            <Star size={14} />
            Купить подписку — 6.5 кбк/мес
          </motion.button>
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
          { icon: <Inbox size={16} />,   label: 'Получено',   value: stats.received, color: 'text-green-400' },
          { icon: <Package size={16} />, label: 'Активных',   value: stats.active,   color: 'text-orange-400' },
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
            <TelegramIcon size={16} />
            <div>
              <p className="text-xs text-dark-500">Telegram</p>
              <p className="text-sm font-medium">{user.telegramUsername || '—'}</p>
            </div>
          </div>
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
          {user.subscriptionActive && subExpires && (
            <div className="flex items-center gap-3">
              <Star size={16} className="text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-dark-500">Подписка до</p>
                <p className="text-sm font-medium text-yellow-400">{formatDate(subExpires.toISOString())}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Change password */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card-static p-5 overflow-hidden"
      >
        <button onClick={() => setChangingPassword(!changingPassword)} className="w-full flex items-center gap-3 text-left">
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
              {[
                { label: 'Текущий пароль',  val: oldPassword,     set: setOldPassword,     show: showOldPass,     setShow: setShowOldPass,     ph: 'Введите текущий пароль' },
                { label: 'Новый пароль',    val: newPassword,     set: setNewPassword,     show: showNewPass,     setShow: setShowNewPass,     ph: 'Минимум 4 символа' },
                { label: 'Повторите пароль', val: confirmPassword, set: setConfirmPassword, show: showConfirmPass, setShow: setShowConfirmPass, ph: 'Повторите новый пароль' },
              ].map(({ label, val, set, show, setShow, ph }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-dark-400 mb-1">{label}</label>
                  <div className="relative">
                    <input type={show ? 'text' : 'password'} className="input-dark pr-10 text-sm" placeholder={ph} value={val} onChange={e => set(e.target.value)} />
                    <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setChangingPassword(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }} className="btn-secondary flex-1 text-sm">Отмена</button>
                <button type="submit" disabled={savingPassword} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  <Save size={14} />{savingPassword ? 'Сохраняем...' : 'Сохранить'}
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
        <button onClick={() => { setChangingAccount(!changingAccount); setNewAccount(''); }} className="w-full flex items-center gap-3 text-left">
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
                <input type="text" className="input-dark text-sm" placeholder="Введите название нового счёта" value={newAccount} onChange={e => setNewAccount(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setChangingAccount(false); setNewAccount(''); }} className="btn-secondary flex-1 text-sm">Отмена</button>
                <button type="submit" disabled={savingAccount} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  <Save size={14} />{savingAccount ? 'Сохраняем...' : 'Сохранить'}
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
          onClick={() => window.open(`https://t.me/kbpostbot?start=reset_${encodeURIComponent(user.username)}`, '_blank', 'noopener,noreferrer')}
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

      {/* ===== POPUP ПОКУПКИ ПОДПИСКИ ===== */}
      <AnimatePresence>
        {showSubPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="popup-overlay"
            onClick={() => setShowSubPopup(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
              className="popup-content"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Star size={18} className="text-yellow-400" />
                  Подписка kbpost
                </h3>
                <button onClick={() => setShowSubPopup(false)} className="text-dark-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="glass-card-static p-4 mb-4 space-y-2">
                <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Что входит в подписку</p>
                {[
                  '⚡ Быстрая доставка',
                  '💸 Быстрый перевод средств',
                  '🔇 Отключение рекламы в боте (/disadv)',
                  '🎯 Приоритет тикета в поддержке',
                  '🎨 Бонус: мап-арт',
                  '🏷️ Скидка на покупку рекламы',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-dark-200">
                    <CheckCircle size={13} className="text-yellow-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="glass-card-static p-4 mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-dark-400">Стоимость</span>
                  <span className="text-lg font-bold text-yellow-400">6.5 кбк / месяц</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-dark-400">Счёт получателя</span>
                  <span className="text-sm font-semibold text-red-400">kbpost</span>
                </div>
              </div>

              <div className="glass-card-static p-4 mb-4 space-y-2">
                <h4 className="text-sm font-semibold text-white">📋 Инструкция по оплате:</h4>
                <ol className="text-sm text-dark-300 space-y-1.5 list-decimal list-inside">
                  <li>Откройте банк-бота <a href="https://t.me/anorloxbot" target="_blank" rel="noopener noreferrer" className="text-red-400 font-medium underline">«анорлохбот»</a></li>
                  <li>Отправьте боту команду <span className="text-red-400 font-mono font-medium">/transfer</span></li>
                  <li>Переведите <span className="text-yellow-400 font-semibold">6.5 кбк</span> на счёт <span className="text-red-400 font-semibold">kbpost</span></li>
                  <li>После перевода нажмите кнопку <span className="text-green-400 font-medium">«Я оплатил»</span> ниже</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowSubPopup(false)} className="btn-secondary flex-1">Отмена</button>
                <button
                  onClick={handleSubscriptionPay}
                  disabled={sendingSubRequest}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {sendingSubRequest ? 'Отправляем...' : 'Я оплатил'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== POPUP ИНФОРМАЦИИ О ПОДПИСКЕ ===== */}
      <AnimatePresence>
        {showSubInfoPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="popup-overlay"
            onClick={() => setShowSubInfoPopup(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
              className="popup-content"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Star size={18} className="text-yellow-400" />
                  Ваша подписка
                </h3>
                <button onClick={() => setShowSubInfoPopup(false)} className="text-dark-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Благодарность */}
              <div className="glass-card-static p-4 mb-4 text-center space-y-1">
                <p className="text-yellow-400 font-semibold text-base">⭐ Спасибо за поддержку!</p>
                <p className="text-dark-300 text-sm">
                  Ваша подписка помогает развивать kbpost.
                </p>
              </div>

              {/* Срок */}
              {subExpires && (
                <div className="glass-card-static p-4 mb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">Активна до</span>
                    <span className="text-sm font-semibold text-yellow-400">
                      {formatDate(subExpires.toISOString())}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">Осталось дней</span>
                    <span className={`text-sm font-bold ${subDaysLeft <= 5 ? 'text-red-400' : 'text-green-400'}`}>
                      {subDaysLeft} {subDaysLeft === 1 ? 'день' : subDaysLeft < 5 ? 'дня' : 'дней'}
                    </span>
                  </div>
                </div>
              )}

              {/* Преимущества */}
              <div className="glass-card-static p-4 mb-4 space-y-2">
                <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Ваши привилегии</p>
                {[
                  '⚡ Быстрая доставка',
                  '💸 Быстрый перевод средств',
                  '🔇 Отключение рекламы в боте (/disadv)',
                  '🎯 Приоритет тикета в поддержке',
                  '🎨 Бонус: мап-арт',
                  '🏷️ Скидка на покупку рекламы',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-dark-200">
                    <CheckCircle size={13} className="text-yellow-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <button onClick={() => setShowSubInfoPopup(false)} className="btn-primary w-full">
                Закрыть
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
