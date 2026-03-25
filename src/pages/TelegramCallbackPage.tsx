import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserByUsername, updateUser } from '../db';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

/**
 * Обрабатывает callback-ссылки от Telegram бота (открывается как mini-app):
 * - #/tg-callback?action=reset&user=USERNAME&pwd=NEWPWD  — сброс пароля
 * - #/tg-callback?action=link&user=USERNAME&tg=@TGUSERNAME&token=TOKEN&cid=CHATID — привязка
 */
export default function TelegramCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const siteUsername = params.get('user');

    if (!action || !siteUsername) {
      setStatus('error');
      setMessage('Неверная ссылка.');
      return;
    }

    // === СБРОС ПАРОЛЯ ===
    if (action === 'reset') {
      const newPwd = params.get('pwd');
      if (!newPwd || newPwd.length < 4) {
        setStatus('error');
        setMessage('Неверный или слишком короткий пароль.');
        return;
      }

      const targetUser = getUserByUsername(siteUsername);
      if (!targetUser) {
        setStatus('error');
        setMessage(`Пользователь "${siteUsername}" не найден.`);
        return;
      }

      updateUser(targetUser.id, { password: newPwd });
      setStatus('success');
      setMessage(`Пароль для "${siteUsername}" успешно изменён! Теперь вы можете войти.`);

      setTimeout(() => navigate('/auth', { replace: true }), 2000);
      return;
    }

    // === ПРИВЯЗКА TELEGRAM ===
    if (action === 'link') {
      const tgUsername = params.get('tg');
      const token = params.get('token');
      const chatId = params.get('cid');

      if (!tgUsername || !token) {
        setStatus('error');
        setMessage('Неверные данные привязки.');
        return;
      }

      // Сохраняем результат привязки — AuthPage прочитает при открытии
      const linkData = { tgUsername, token, siteUsername, ts: Date.now() };
      localStorage.setItem('kbpost_tg_link_result', JSON.stringify(linkData));

      // Сохраняем chatId для уведомлений
      if (chatId) {
        const tgKey = `kbpost_tg_chatid_${tgUsername.toLowerCase().replace('@', '')}`;
        localStorage.setItem(tgKey, chatId);
      }

      setStatus('success');
      setMessage(`Telegram ${tgUsername} привязан! Возвращаемся к регистрации...`);

      // Навигируем на /auth с флагом что нужно открыть register
      setTimeout(() => navigate('/auth?mode=register', { replace: true }), 1500);
      return;
    }

    setStatus('error');
    setMessage('Неизвестное действие.');
  }, []);

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
      </motion.div>
    </div>
  );
}
