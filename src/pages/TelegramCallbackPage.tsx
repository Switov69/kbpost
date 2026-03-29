import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { apiCheckToken, apiConfirmToken, setToken } from '../api';
import { useAuth } from '../context';

/**
 * Обрабатывает callback-ссылки от Telegram бота (обычный браузер):
 *
 * Новый формат (token — UUID, в pending_actions):
 *   /#/tg-callback?token=UUID&action=link  — привязка TG к существующему аккаунту
 *   /#/tg-callback?token=UUID&action=reset — сброс пароля
 *
 * Prelink-формат (регистрация нового пользователя, token НЕ в pending_actions):
 *   /#/tg-callback?action=link&user=USERNAME&tg=@TG&token=TOKEN&cid=CHATID
 */

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default function TelegramCallbackPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { refreshUser } = useAuth();

  const [status, setStatus]           = useState<'loading' | 'success' | 'error' | 'need_password'>('loading');
  const [message, setMessage]         = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    processCallback();
  }, []);

  async function processCallback() {
    const params       = new URLSearchParams(location.search);
    const action       = params.get('action');
    const token        = params.get('token');
    const tgUsername   = params.get('tg');
    const siteUsername = params.get('user');
    const chatId       = params.get('cid');

    // ===== НОВЫЙ ФОРМАТ: ?token=UUID&action=link|reset =====
    if (token && isUUID(token) && (action === 'link' || action === 'reset')) {
      try {
        const { actionType } = await apiCheckToken(token);

        if (actionType === 'link_tg') {
          // Подтверждаем привязку. Сервер создаёт сессию и возвращает Set-Cookie + { token, user }.
          const result = await apiConfirmToken(token) as any;

          if (result.token && result.user) {
            // Сохраняем токен в sessionStorage для apiFetch
            setToken(result.token);
            // Обновляем контекст пользователя
            await refreshUser().catch(() => {});
            setStatus('success');
            setMessage('Telegram привязан! Вы авторизованы. Переходим...');
            setTimeout(() => navigate('/', { replace: true }), 1500);
          } else {
            // Fallback: сессия не вернулась — сохраняем в sessionStorage для AuthPage
            const linkedTg   = result?.user?.telegramId ? `@${result.user.telegramId}` : (tgUsername || '');
            const linkedUser = result?.user?.username   || siteUsername || '';
            sessionStorage.setItem('kbpost_tg_link_result', JSON.stringify({
              tgUsername: linkedTg, token, siteUsername: linkedUser, ts: Date.now(),
            }));
            setStatus('success');
            setMessage('Telegram привязан! Возвращаемся...');
            setTimeout(() => navigate('/auth?mode=register', { replace: true }), 1500);
          }
          return;
        }

        if (actionType === 'reset_password') {
          setPendingToken(token);
          setStatus('need_password');
          return;
        }

        setStatus('error');
        setMessage('Неизвестный тип действия.');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Токен недействителен или истёк.');
      }
      return;
    }

    // ===== PRELINK / LEGACY ФОРМАТ =====
    // token — короткий (8 символов от Math.random), НЕ UUID, НЕ в pending_actions.
    // Используется при регистрации через бота (prelink_).

    if (action === 'link') {
      if (!tgUsername || !siteUsername) {
        setStatus('error');
        setMessage('Неверные данные привязки Telegram.');
        return;
      }

      // Сохраняем в sessionStorage — AuthPage прочитает и заполнит форму
      sessionStorage.setItem('kbpost_tg_link_result', JSON.stringify({
        tgUsername,
        token: token || '',
        siteUsername,
        ts: Date.now(),
      }));

      if (chatId) {
        localStorage.setItem(
          `kbpost_tg_chatid_${tgUsername.toLowerCase().replace('@', '')}`,
          chatId
        );
      }

      setStatus('success');
      setMessage(`Telegram ${tgUsername} привязан! Возвращаемся к регистрации...`);
      setTimeout(() => navigate('/auth?mode=register', { replace: true }), 1500);
      return;
    }

    // Устаревший reset без pending_actions
    if (action === 'reset') {
      const newPwd = params.get('pwd');
      if (!newPwd || newPwd.length < 4) {
        setStatus('error');
        setMessage('Неверный или слишком короткий пароль.');
        return;
      }
      setStatus('success');
      setMessage(`Пароль для «${siteUsername}» успешно изменён! Теперь вы можете войти.`);
      setTimeout(() => navigate('/auth', { replace: true }), 2000);
      return;
    }

    setStatus('error');
    setMessage('Неверная или устаревшая ссылка.');
  }

  async function handlePasswordSubmit() {
    if (!pendingToken || !newPassword.trim() || newPassword.length < 4) return;
    setSubmitting(true);
    try {
      await apiConfirmToken(pendingToken, newPassword);
      setStatus('success');
      setMessage('Пароль успешно изменён! Теперь вы можете войти.');
      setTimeout(() => navigate('/auth', { replace: true }), 2000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Ошибка при смене пароля.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-4 relative">
      <div className="bg-animated" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card-static p-8 max-w-sm w-full text-center space-y-4"
      >
        {status === 'loading' && (
          <>
            <Loader size={40} className="text-red-400 mx-auto animate-spin" />
            <p className="text-dark-300 text-sm">Обработка...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <p className="text-white font-semibold">Готово!</p>
            <p className="text-dark-300 text-sm">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} className="text-red-400 mx-auto" />
            <p className="text-white font-semibold">Ошибка</p>
            <p className="text-dark-300 text-sm">{message}</p>
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="btn-primary w-full mt-2"
            >
              На страницу входа
            </button>
          </>
        )}
        {status === 'need_password' && (
          <>
            <p className="text-white font-semibold">Введите новый пароль</p>
            <input
              type="password"
              className="input-dark"
              placeholder="Минимум 4 символа"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <button
              onClick={handlePasswordSubmit}
              disabled={submitting || newPassword.length < 4}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? 'Сохраняем...' : 'Сохранить пароль'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
