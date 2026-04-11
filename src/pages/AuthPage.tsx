import { useState, useEffect, useCallback } from 'react';
import { useAuth, useToast, sendRegistrationNotification } from '../context';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, LogIn, UserPlus, CheckCircle, MessageCircle } from 'lucide-react';

const BOT_USERNAME = 'kbpostbot';

const TelegramIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialMode = new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const { login, register } = useAuth();
  const { addToast } = useToast();

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [regUsername, setRegUsername] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regTelegramLinked, setRegTelegramLinked] = useState(false);
  const [regPassword, setRegPassword] = useState('');
  const [regCitizenship, setRegCitizenship] = useState('');
  const [regAccount, setRegAccount] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  // После клика «Привязать Telegram» скрываем форму и показываем экран ожидания
  const [botRedirected, setBotRedirected] = useState(false);

  // Читаем результат привязки из sessionStorage (записывается TelegramCallbackPage)
  const applyLinkResult = useCallback(() => {
    const raw = sessionStorage.getItem('kbpost_tg_link_result');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw) as { tgUsername: string; token: string; siteUsername: string; ts: number };
      if (Date.now() - data.ts > 15 * 60 * 1000) {
        sessionStorage.removeItem('kbpost_tg_link_result');
        return false;
      }
      setRegTelegram(data.tgUsername);
      setRegTelegramLinked(true);
      if (data.siteUsername && !regUsername) setRegUsername(data.siteUsername);
      setMode('register');
      setBotRedirected(false);
      sessionStorage.removeItem('kbpost_tg_link_result');
      addToast(`Telegram ${data.tgUsername} привязан! ✅`, 'success');
      return true;
    } catch {
      sessionStorage.removeItem('kbpost_tg_link_result');
      return false;
    }
  }, [regUsername, addToast]);

  useEffect(() => {
    applyLinkResult();
  }, []);

  // Опрос sessionStorage пока пользователь на экране ожидания
  useEffect(() => {
    if (!botRedirected) return;
    const interval = setInterval(() => {
      const found = applyLinkResult();
      if (found) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [botRedirected, applyLinkResult]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      addToast('Заполните все поля', 'error');
      return;
    }
    setLoginLoading(true);
    const ok = await login(loginUsername, loginPassword);
    setLoginLoading(false);
    if (ok) {
      addToast('Добро пожаловать! 👋', 'success');
    } else {
      addToast('Неверный никнейм или пароль', 'error');
    }
  };

  const handleResetPassword = () => {
    const username = loginUsername.trim();
    if (!username) {
      addToast('Сначала введите никнейм', 'error');
      return;
    }
    window.open(
      `https://t.me/${BOT_USERNAME}?start=reset_${encodeURIComponent(username)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleLinkTelegram = () => {
    const username = regUsername.trim();
    if (!username) {
      addToast('Сначала введите никнейм', 'error');
      return;
    }
    // Генерируем лёгкий токен-идентификатор для prelink.
    // НЕ записывается в БД — передаётся через URL и проверяется на фронте.
    const token = Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem(`kbpost_link_token_${username.toLowerCase()}`, token);

    // Открываем бота в новой вкладке
    window.open(
      `https://t.me/${BOT_USERNAME}?start=prelink_${encodeURIComponent(username)}_${token}`,
      '_blank',
      'noopener,noreferrer'
    );

    // Скрываем форму, показываем экран ожидания
    setBotRedirected(true);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTelegramLinked || !regTelegram.trim()) {
      addToast('Привяжите Telegram аккаунт', 'error');
      return;
    }
    setRegLoading(true);
    const result = await register({
      username:        regUsername,
      telegramUsername: regTelegram.startsWith('@') ? regTelegram : `@${regTelegram}`,
      password:        regPassword,
      citizenship:     regCitizenship,
      account:         regAccount,
    });
    setRegLoading(false);
    if (result.success) {
      addToast('Регистрация успешна! 🎉', 'success');
      sendRegistrationNotification(regTelegram, regUsername).catch(() => {});
    } else {
      addToast(result.error || 'Ошибка регистрации', 'error');
    }
  };

  // ─── Экран ожидания после открытия бота ──────────────────────────────────
  if (botRedirected) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-4 relative">
        <div className="bg-animated" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card-static p-8 max-w-sm w-full text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#229ED9]/20 flex items-center justify-center mx-auto">
            <MessageCircle size={32} className="text-[#229ED9]" />
          </div>
          <div className="space-y-2">
            <p className="text-white font-semibold text-lg">
              Окно регистрации открыто в боте
            </p>
            <p className="text-dark-400 text-sm leading-relaxed">
              Перейдите в Telegram-бота{' '}
              <span className="text-white font-medium">@{BOT_USERNAME}</span>,
              нажмите «Подтвердить и продолжить», затем вернитесь на эту страницу.
            </p>
            <p className="text-dark-500 text-xs">
              Страница обновится автоматически после подтверждения.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                const found = applyLinkResult();
                if (!found) addToast('Привязка ещё не подтверждена. Перейдите в бота.', 'info');
              }}
              className="btn-primary w-full"
            >
              <CheckCircle size={18} />
              Я уже привязал аккаунт
            </button>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-dark-400 hover:text-white transition-colors"
            >
              Эту вкладку можно закрыть
            </button>
          </div>
        </motion.div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-4 relative">
      <div className="bg-animated" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-3 mb-8"
      >
        <h1 className="text-4xl font-bold font-logo tracking-wider">
          <span className="text-red-500">kb</span>post
        </h1>
        <p className="text-dark-400 text-sm">Удобная почта для КБшеров</p>
      </motion.div>

      {/* Mode toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-full max-w-sm mb-4"
      >
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              mode === 'login'
                ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Авторизация
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              mode === 'register'
                ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Регистрация
          </button>
        </div>
      </motion.div>

      {/* Forms */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="w-full max-w-sm"
      >
        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleLogin}
              className="glass-card-static p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Никнейм</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Введите никнейм"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Пароль</label>
                <div className="relative">
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    className="input-dark pr-12"
                    placeholder="Введите пароль"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                  >
                    {showLoginPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loginLoading}>
                <LogIn size={18} />
                {loginLoading ? 'Входим...' : 'Войти'}
              </button>
              <p className="text-xs text-center text-dark-500">
                Забыли пароль? Сбросьте через{' '}
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-red-400 underline hover:text-red-300 transition-colors"
                >
                  бота
                </button>
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRegister}
              className="glass-card-static p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Никнейм</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Ваш игровой никнейм"
                  value={regUsername}
                  onChange={e => {
                    setRegUsername(e.target.value);
                    if (regTelegramLinked) {
                      setRegTelegramLinked(false);
                      setRegTelegram('');
                    }
                  }}
                />
              </div>

              {/* Telegram привязка */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Telegram</label>
                {regTelegramLinked && regTelegram ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="w-9 h-9 rounded-xl bg-[#229ED9]/20 flex items-center justify-center flex-shrink-0">
                      <TelegramIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                        <span className="text-sm text-green-400 font-semibold truncate">{regTelegram}</span>
                      </div>
                      <p className="text-[10px] text-dark-400 mt-0.5">Telegram привязан</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setRegTelegramLinked(false); setRegTelegram(''); }}
                      className="text-xs text-dark-400 hover:text-white transition-colors flex-shrink-0"
                    >
                      Изменить
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkTelegram}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#229ED9] text-sm font-semibold hover:bg-[#229ED9]/25 transition-all duration-200"
                  >
                    <TelegramIcon size={18} />
                    Привязать Telegram
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Пароль</label>
                <div className="relative">
                  <input
                    type={showRegPass ? 'text' : 'password'}
                    className="input-dark pr-12"
                    placeholder="Минимум 4 символа"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass(!showRegPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                  >
                    {showRegPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Гражданство</label>
                <div className="flex gap-2">
                  {['Столица', 'Антегрия'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRegCitizenship(c)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        regCitizenship === c
                          ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20 border border-red-500/30'
                          : 'bg-white/5 border border-white/10 text-dark-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Счёт</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Название счёта"
                  value={regAccount}
                  onChange={e => setRegAccount(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={regLoading}>
                <UserPlus size={18} />
                {regLoading ? 'Регистрируемся...' : 'Зарегистрироваться'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
