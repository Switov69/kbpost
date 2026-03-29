import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import {
  apiLogin, apiLogout, apiRegister, apiGetProfile,
  setToken, getToken,
  type UserDTO,
} from './api';

// ===== TELEGRAM helpers (клиентские) =====

const BOT_TOKEN = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BOT_TOKEN) || '';
const WEBAPP_URL = 'https://kbpost.vercel.app';

// Отправляем обычную url-кнопку вместо web_app — Mini App упразднён
async function sendTelegramMessage(chatId: string | number, text: string, withButton = true) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (withButton) {
      body.reply_markup = {
        inline_keyboard: [[{ text: '📦 Открыть kbpost', url: WEBAPP_URL }]],
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

// ===== AUTH CONTEXT =====

interface AuthContextValue {
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
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => false,
  register: async () => ({ success: false }),
  logout: () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ===== TOAST CONTEXT =====

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ===== PROVIDER =====

function userDtoToModel(dto: UserDTO): User {
  return {
    id:                  dto.id,
    username:            dto.username,
    telegramUsername:    dto.telegramId ? `@${dto.telegramId}` : '',
    telegramId:          dto.telegramId,
    password:            '',
    citizenship:         dto.citizenship,
    account:             dto.account,
    isAdmin:             dto.isAdmin,
    balance:             dto.balance ?? 0,
    createdAt:           dto.createdAt || new Date().toISOString(),
    subscriptionActive:  dto.subscriptionActive ?? false,
    subscriptionExpires: dto.subscriptionExpires ?? null,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts]   = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const dto = await apiGetProfile();
      setUser(userDtoToModel(dto));
    } catch {
      setUser(null);
    }
  }, []);

  // Восстановление сессии при загрузке
  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      apiGetProfile()
        .then(dto => setUser(userDtoToModel(dto)))
        .catch(() => { setUser(null); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const { token, user: dto } = await apiLogin(username, password);
      setToken(token);
      setUser(userDtoToModel(dto));
      return true;
    } catch {
      return false;
    }
  }, []);

  const register = useCallback(async (data: {
    username: string;
    telegramUsername: string;
    password: string;
    citizenship: string;
    account: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { token, user: dto } = await apiRegister(data);
      setToken(token);
      setUser(userDtoToModel(dto));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout().catch(() => {});
    setUser(null);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
        {children}

        {/* Toast уведомления */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="toast-glass flex items-center gap-3 px-4 py-3 rounded-2xl pointer-events-auto shadow-xl"
              >
                {toast.type === 'success' && <CheckCircle size={18} className="text-green-400 flex-shrink-0" />}
                {toast.type === 'error'   && <XCircle     size={18} className="text-red-400 flex-shrink-0" />}
                {toast.type === 'info'    && <Info        size={18} className="text-blue-400 flex-shrink-0" />}
                <p className="text-sm text-white font-medium flex-1">{toast.message}</p>
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-dark-400 hover:text-white transition-colors flex-shrink-0 pointer-events-auto"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </AuthContext.Provider>
    </ToastContext.Provider>
  );
}
