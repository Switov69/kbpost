import { useState, useEffect } from 'react';
import type { AppPage, TelegramUser, UserProfile } from './types';
import { getUserByTelegramId, upsertSession, initDb } from './api';
import { PinPad } from './components/PinPad';
import { DockPanel } from './components/DockPanel';
import { ParcelsPage } from './pages/ParcelsPage';
import { CreatePage } from './pages/CreatePage';
import { SettingsPage } from './pages/SettingsPage';
import { RegisterPage } from './pages/RegisterPage';
import { verifyPin } from './api';
import { IconLogo } from './components/Icons';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          auth_date?: number;
          hash?: string;
        };
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation: () => void;
        MainButton: {
          show: () => void;
          hide: () => void;
        };
        colorScheme: string;
        themeParams: Record<string, string>;
        platform: string;
      };
    };
  }
}

type AppPhase = 'loading' | 'no_tma' | 'register' | 'pin' | 'main' | 'db_error';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [page, setPage] = useState<AppPage>('parcels');
  const [pinError, setPinError] = useState('');
  const [isPinLoading, setIsPinLoading] = useState(false);
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    const init = async () => {
      const tg = window.Telegram?.WebApp;

      let tgUser: TelegramUser | null = null;

      if (tg && tg.initDataUnsafe?.user) {
        tg.ready();
        tg.expand();
        tgUser = tg.initDataUnsafe.user;
      } else {
        const isDev = import.meta.env.DEV;
        if (isDev) {
          tgUser = { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' };
        } else {
          setPhase('no_tma');
          return;
        }
      }

      setTelegramUser(tgUser);

      try {
        await initDb();
        await upsertSession(tgUser);
        const profile = await getUserByTelegramId(tgUser.id);
        if (!profile) {
          setPhase('register');
        } else {
          setUser(profile);
          setPhase('pin');
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Ошибка подключения к базе данных';
        setDbError(msg);
        setPhase('db_error');
      }
    };

    init();
  }, []);

  const handleRegistered = (profile: UserProfile) => {
    setUser(profile);
    setPhase('pin');
  };

  const handlePinComplete = async (pin: string) => {
    if (!telegramUser) return;
    setIsPinLoading(true);
    setPinError('');
    try {
      const ok = await verifyPin(telegramUser.id, pin);
      if (ok) {
        setPhase('main');
      } else {
        setPinError('Неверный пароль');
        setTimeout(() => setPinError(''), 2000);
      }
    } catch {
      setPinError('Ошибка проверки');
    } finally {
      setIsPinLoading(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ animation: 'fadeIn 0.5s ease' }}>
          <IconLogo size={60} />
        </div>
        <div className="text-2xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: '-1px', animation: 'fadeIn 0.6s ease 0.1s both' }}>
          KBPOST
        </div>
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin mt-2" style={{ borderColor: '#F5C518', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (phase === 'no_tma') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg-primary)' }}>
        <IconLogo size={56} />
        <h1 className="text-2xl font-black mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>KBPOST</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Это приложение доступно только через <strong style={{ color: '#F5C518' }}>Telegram Mini Apps</strong>
        </p>
        <div className="card p-4 w-full max-w-xs">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Откройте бот в Telegram и нажмите кнопку <strong>«Открыть KBPOST»</strong>
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'db_error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Ошибка подключения</h2>
        <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Не удалось подключиться к базе данных.</p>
        <p className="text-xs font-mono p-3 rounded-xl w-full max-w-xs text-left" style={{ background: 'var(--bg-secondary)', color: '#f04747' }}>{dbError}</p>
        <button className="btn-secondary mt-4" onClick={() => window.location.reload()}>Повторить</button>
      </div>
    );
  }

  if (phase === 'register' && telegramUser) {
    return <RegisterPage telegramUser={telegramUser} onRegistered={handleRegistered} />;
  }

  if (phase === 'pin') {
    return (
      <PinPad
        title="Введите пароль"
        subtitle={`Добро пожаловать, @${user?.nickname}`}
        onComplete={handlePinComplete}
        onError={pinError}
        isLoading={isPinLoading}
      />
    );
  }

  if (phase === 'main' && user) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="noise-overlay" />

        {page === 'parcels' && <ParcelsPage user={user} />}
        {page === 'create' && (
          <CreatePage
            user={user}
            onCreated={() => setPage('parcels')}
          />
        )}
        {page === 'settings' && (
          <SettingsPage
            user={user}
            onUserUpdate={setUser}
          />
        )}

        <DockPanel currentPage={page} onNavigate={setPage} />
      </div>
    );
  }

  return null;
}
