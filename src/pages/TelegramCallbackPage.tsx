import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { apiCheckToken, apiConfirmToken } from '../api';

/**
 * Обрабатывает callback-ссылки от Telegram бота (открывается как mini-app):
 *
 * Новая архитектура (токены):
 *   /#/tg-callback?token=UUID&action=link  — привязка TG
 *   /#/tg-callback?token=UUID&action=reset — сброс пароля (нужен ввод пароля)
 *
 * Совместимость с устаревшим форматом бота (без pending_actions):
 *   /#/tg-callback?action=link&user=USERNAME&tg=@TG&token=TOKEN&cid=CHATID
 *   /#/tg-callback?action=reset&user=USERNAME&pwd=NEWPWD
 */
export default function TelegramCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'need_password'>('loading');
  const [message, setMessage] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    processCallback();
  }, []);

  async function processCallback() {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const token  = params.get('token');

    // ===== НОВЫЙ ФОРМАТ: ?token=UUID&action=link|reset =====
    if (token && (action === 'link' || action === 'reset')) {
      try {
        const { actionType, data } = await apiCheckToken(token);

        if (actionType === 'link_tg') {
          // Привязка — подтверждаем сразу
          await apiConfirmToken(token);
          const tgUsername = data.tgUsername || '';
          const siteUsername = data.siteUsername || '';

          // Сохраняем результат для AuthPage
          const linkData = { tgUsername, token, siteUsername, ts: Date.now() };
          sessionStorage.setItem('kbpost_tg_link_result', JSON.stringify(linkData));

          setStatus('success');
          setMessage(`Telegram ${tgUsername} привязан! Возвращаемся к регистрации...`);
          setTimeout(() => navigate('/auth?mode=register', { replace: true }), 1500);
          return;
        }

        if (actionType === 'reset_password') {
          // Нужно ввести новый пароль
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

    // ===== УСТАРЕВШИЙ ФОРМАТ (без pending_actions) =====
    const siteUsername = params.get('user');

    if (!action || !siteUsername) {
      setStatus('error');
      setMessage('Неверная ссылка.');
      return;
    }

    // Устаревший reset: ?action=reset&user=X&pwd=Y
    if (action === 'reset') {
      const newPwd = params.get('pwd');
      if (!newPwd || newPwd.length < 4) {
        setStatus('error');
        setMessage('Неверный или слишком короткий пароль.');
        return;
      }
      // В устаревшем формате нет токена — просто сообщаем об успехе
      // (реальный сброс делает бот через новый API)
      setStatus('success');
      setMessage(`Пароль для "${siteUsername}" успешно изменён! Теперь вы можете войти.`);
      setTimeout(() => navigate('/auth', { replace: true }), 2000);
      return;
    }

    // Устаревший link: ?action=link&user=X&tg=@Y&token=T&cid=C
    if (action === 'link') {
      const tgUsername = params.get('tg');
      const chatId     = params.get('cid');

      if (!tgUsername) {
        setStatus('error');
        setMessage('Неверные данные привязки.');
        return;
      }

      // Сохраняем результат для AuthPage (legacy: в sessionStorage)
      const linkData = { tgUsername, token: token || '', siteUsername, ts: Date.now() };
      sessionStorage.setItem('kbpost_tg_link_result', JSON.stringify(linkData));

      // Сохраняем chatId для TG уведомлений (legacy)
      if (chatId) {
        const tgKey = `kbpost_tg_chatid_${tgUsername.toLowerCase().replace('@', '')}`;
        localStorage.setItem(tgKey, chatId);
      }

      setStatus('success');
      setMessage(`Telegram ${tgUsername} привязан! Возвращаемся к регистрации...`);
      setTimeout(() => navigate('/auth?mode=register', { replace: true }), 1500);
      return;
    }

    setStatus('error');
    setMessage('Неизвестное действие.');
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
