import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import {
  apiLogin, apiLogout, apiRegister, apiGetProfile,
  setToken, getToken,
  type UserDTO,
} from './api';

// ===== TELEGRAM helpers (клиентские) =====

const BOT_TOKEN = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BOT_TOKEN) || '8656385676:AAGHHDZYqgmZVoaSzZaMadFeTjjoU3ieLb4';
const WEBAPP_URL = 'https://kbpost.vercel.app';

async function sendTelegramMessage(chatId: string | number, text: string, withButton = true) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (withButton) {
      body.reply_markup = {
        inline_keyboard: [[{ text: '📦 Открыть kbpost', web_app: { url: WEBAPP_URL } }]],
      };
    }
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('TG send error:', e);
  }
}

export async function sendTelegramNotification(chatId: string | number, message: string) {
  await sendTelegramMessage(chatId, message, true);
}

export async function sendRegistrationNotification(_tg: string, _username: string) {}
export function notifyParcelCreated(_s: string, _r: string, _ttn: string) {}
export function sendNotification(message: string) {
  console.log('[kbpost]', message);
}

// ===== USER TYPE =====

export interface User {
  id: string;
  username: string;
  telegramUsername: string;
  telegramId: string | null;
  password: string;
  citizenship: string;
  account: string;
  isAdmin: boolean;
  balance: number;
  createdAt: string;
  subscriptionActive: boolean;
  subscriptionExpires: string | null;
}

function dtoToUser(dto: UserDTO): User {
  return {
    id:                  dto.id,
    username:            dto.username,
    telegramUsername:    dto.telegramId ? `@${dto.telegramId}` : '',
    telegramId:          dto.telegramId ?? null,
    password:            '',
    citizenship:         dto.citizenship,
    account:             dto.account,
    isAdmin:             dto.isAdmin,
    balance:             dto.balance,
    createdAt:           dto.createdAt || new Date().toISOString(),
    subscriptionActive:  dto.subscriptionActive ?? false,
    subscriptionExpires: dto.subscriptionExpires ?? null,
  };
}

// ===== AUTH CONTEXT =====

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (data: {
    username: string;
    telegramUsername: string;
    password: string;
    citizenship: string;
    account: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AppProvider');
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
  if (!ctx) throw new Error('useToast must be used within AppProvider');
  return ctx;
}

// ===== APP PROVIDER =====

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    apiGetProfile()
      .then(dto => setUser(dtoToUser(dto)))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { token, user: dto } = await apiLogin(username, password);
      setToken(token);
      setUser(dtoToUser(dto));
      return true;
    } catch {
      return false;
    }
  };

  const register = async (data: {
    username: string;
    telegramUsername: string;
    password: string;
    citizenship: string;
    account: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!data.username.trim())         return { success: false, error: 'Введите никнейм' };
    if (!data.telegramUsername.trim()) return { success: false, error: 'Привяжите Telegram' };
    if (!data.password.trim() || data.password.length < 4)
      return { success: false, error: 'Пароль должен быть от 4 символов' };
    if (!data.citizenship.trim()) return { success: false, error: 'Выберите гражданство' };
    if (!data.account.trim())     return { success: false, error: 'Укажите счёт' };

    try {
      const { token, user: dto } = await apiRegister({
        username:        data.username.trim(),
        password:        data.password,
        telegramUsername: data.telegramUsername.replace(/^@/, ''),
        citizenship:     data.citizenship.trim(),
        account:         data.account.trim(),
      });
      setToken(token);
      setUser(dtoToUser(dto));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка регистрации' };
    }
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const dto = await apiGetProfile();
      setUser(dtoToUser(dto));
    } catch {}
  };

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      <ToastContext.Provider value={{ addToast }}>
        {children}
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
