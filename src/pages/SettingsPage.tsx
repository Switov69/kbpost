import { useState } from 'react';
import type { UserProfile } from '../types';
import { updateUserSettings } from '../api';
import { IconBell, IconCreditCard, IconRefresh, IconShield, IconUser, IconLogo } from '../components/Icons';
import { CITIZENSHIP_LABELS } from '../data/branches';

interface SettingsPageProps {
  user: UserProfile;
  onUserUpdate: (u: UserProfile) => void;
}

export function SettingsPage({ user, onUserUpdate }: SettingsPageProps) {
  const [notifications, setNotifications] = useState(user.notifications_enabled);
  const [bankAccount, setBankAccount] = useState(user.bank_account);
  const [editingBank, setEditingBank] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const handleNotifToggle = async () => {
    const newVal = !notifications;
    setNotifications(newVal);
    setNotifLoading(true);
    try {
      await updateUserSettings(user.telegram_id, { notifications_enabled: newVal });
      onUserUpdate({ ...user, notifications_enabled: newVal });
    } catch {
      setNotifications(!newVal);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleBankSave = async () => {
    if (!bankAccount.trim()) { setBankError('Введите банковский счёт'); return; }
    setBankLoading(true);
    setBankError('');
    setBankSuccess(false);
    try {
      await updateUserSettings(user.telegram_id, { bank_account: bankAccount });
      onUserUpdate({ ...user, bank_account: bankAccount });
      setEditingBank(false);
      setBankSuccess(true);
      setTimeout(() => setBankSuccess(false), 2000);
    } catch {
      setBankError('Ошибка обновления');
    } finally {
      setBankLoading(false);
    }
  };

  const joinDate = new Date(user.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="page-content px-4 pt-4">
      <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Настройки</h1>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.25)' }}
          >
            <IconUser size={26} color="#F5C518" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
              @{user.nickname}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {CITIZENSHIP_LABELS[user.citizenship]}
              </span>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              С нами с {joinDate}
            </div>
          </div>
        </div>
      </div>

      <SectionTitle>Аккаунт</SectionTitle>

      <div className="card mb-3 overflow-hidden">
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,197,24,0.1)' }}>
                <IconCreditCard size={16} color="#F5C518" />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Банковский счёт</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.bank_account}</div>
              </div>
            </div>
            <button
              onClick={() => { setEditingBank(!editingBank); setBankError(''); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(245,197,24,0.1)', color: '#F5C518', border: '1px solid rgba(245,197,24,0.2)', cursor: 'pointer' }}
            >
              {editingBank ? 'Отмена' : 'Изменить'}
            </button>
          </div>
          {editingBank && (
            <div className="mt-3 fade-in">
              <input
                type="text"
                className="input-field mb-2"
                placeholder="Новый банковский счёт"
                value={bankAccount}
                onChange={e => setBankAccount(e.target.value)}
                autoFocus
              />
              {bankError && <p className="text-xs mb-2" style={{ color: '#f04747' }}>{bankError}</p>}
              <button
                className="btn-accent w-full text-sm py-2.5"
                onClick={handleBankSave}
                disabled={bankLoading}
                style={{ padding: '10px' }}
              >
                {bankLoading ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          )}
          {bankSuccess && !editingBank && (
            <p className="text-xs mt-2" style={{ color: '#57f287' }}>✓ Счёт обновлён</p>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(88,101,242,0.1)' }}>
                <IconBell size={16} color="#5865F2" />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Уведомления</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {notifLoading ? 'Обновляем...' : notifications ? 'Включены' : 'Отключены'}
                </div>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={notifications}
                onChange={handleNotifToggle}
                disabled={notifLoading}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      <SectionTitle>Безопасность</SectionTitle>

      <div className="card mb-3 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(87,242,135,0.1)' }}>
              <IconShield size={16} color="#57f287" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Код-пароль</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Сбросить можно через бота</div>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <IconRefresh size={14} color="#80848e" />
            </div>
          </div>
          <div
            className="mt-3 p-3 rounded-xl"
            style={{ background: 'rgba(245,197,24,0.05)', border: '1px solid rgba(245,197,24,0.15)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              📱 Чтобы сбросить пароль, отправьте <code style={{ color: '#F5C518' }}>/resetpin</code> нашему боту в Telegram
            </p>
          </div>
        </div>
      </div>

      <SectionTitle>О приложении</SectionTitle>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <IconLogo size={40} />
          <div>
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>KBPOST</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Виртуальная почта Minecraft сервера</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Версия 1.0.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
      {children}
    </div>
  );
}
