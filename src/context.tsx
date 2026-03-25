import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from './types';
import { initDB, getUserByUsername, createUser as dbCreateUser, getUserById } from './db';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

// ===== TELEGRAM BOT API =====

const BOT_TOKEN = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BOT_TOKEN) || '8656385676:AAGHHDZYqgmZVoaSzZaMadFeTjjoU3ieLb4';
const WEBAPP_URL = 'https://019d1335-6701-773e-bd4c-ab954bbe51d7.arena.site/';

export async function sendTelegramNotification(chatId: string | number, message: string) {
  if (!BOT_TOKEN) {
    console.log('[kbpost notification]:', message);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}

// Отправляет приветственное сообщение пользователю после регистрации
export async function sendRegistrationNotification(telegramUsername: string, siteUsername: string) {
  // Ищем chatId в сессии (бот должен был сохранить его при привязке)
  const sessionKey = `kbpost_tg_chatid_${telegramUsername.toLowerCase().replace('@', '')}`;
  const chatId = localStorage.getItem(sessionKey);
  if (!chatId) return;
  await sendTelegramNotification(chatId,
    `🎉 <b>Добро пожаловать в kbpost!</b>\n\n` +
    `Вы успешно зарегистрировались как <code>${siteUsername}</code>.\n\n` +
    `Теперь вы можете отправлять и получать посылки.`,
  );
}

export function sendNotification(message: string) {
  console.log('[kbpost notification]:', message);
}

// ===== AUTH CONTEXT =====

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  register: (data: {
    username: string;
    telegramUsername: string;
    password: string;
    citizenship: string;
    account: string;
  }) => { success: boolean; error?: string };
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ===== TOAST CONTEXT =====

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ===== APP PROVIDER =====

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initDB();
    const savedUserId = localStorage.getItem('kbpost_current_user_id');
    if (savedUserId) {
      const freshUser = getUserById(savedUserId);
      if (freshUser) setUser(freshUser);
    }
    setLoading(false);
  }, []);

  const login = (username: string, password: string): boolean => {
    const found = getUserByUsername(username);
    if (found && found.password === password) {
      setUser(found);
      localStorage.setItem('kbpost_current_user_id', found.id);
      return true;
    }
    return false;
  };

  const register = (data: {
    username: string;
    telegramUsername: string;
    password: string;
    citizenship: string;
    account: string;
  }) => {
    if (!data.username.trim()) return { success: false, error: 'Введите никнейм' };
    if (!data.telegramUsername.trim()) return { success: false, error: 'Введите Telegram @username' };
    if (!data.password.trim() || data.password.length < 4)
      return { success: false, error: 'Пароль должен быть от 4 символов' };
    if (!data.citizenship.trim()) return { success: false, error: 'Выберите гражданство' };
    if (!data.account.trim()) return { success: false, error: 'Укажите счёт' };

    const existing = getUserByUsername(data.username);
    if (existing) return { success: false, error: 'Пользователь с таким никнеймом уже существует' };

    const tgFormatted = data.telegramUsername.startsWith('@')
      ? data.telegramUsername
      : `@${data.telegramUsername}`;

    const newUser = dbCreateUser({
      username: data.username,
      telegramUsername: tgFormatted,
      password: data.password,
      citizenship: data.citizenship,
      account: data.account,
    });
    setUser(newUser);
    localStorage.setItem('kbpost_current_user_id', newUser.id);
    sendNotification(`Добро пожаловать в kbpost, ${newUser.username}!`);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('kbpost_current_user_id');
  };

  const refreshUser = () => {
    if (user) {
      const freshUser = getUserById(user.id);
      if (freshUser) {
        setUser(freshUser);
      }
    }
  };

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="bg-animated" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <span className="text-2xl font-bold font-logo tracking-wider">
            <span className="text-red-500">kb</span>post
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser }}>
      <ToastContext.Provider value={{ addToast }}>
        {children}

        {/* Toast container — centered */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100] flex flex-col gap-2 pointer-events-none items-center">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto w-full px-4 py-3 rounded-xl text-sm font-medium toast-glass flex items-center gap-3 cursor-pointer ${
                  toast.type === 'success'
                    ? 'border border-green-500/30 text-green-400'
                    : toast.type === 'error'
                    ? 'border border-red-500/30 text-red-400'
                    : 'border border-blue-500/30 text-blue-400'
                }`}
                onClick={() => removeToast(toast.id)}
              >
                {toast.type === 'success' && <CheckCircle size={18} />}
                {toast.type === 'error' && <XCircle size={18} />}
                {toast.type === 'info' && <Info size={18} />}
                <span className="flex-1 text-center">{toast.message}</span>
                <X size={14} className="opacity-50 hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
