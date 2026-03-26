import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { Home, PlusCircle, User, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return <>{children}</>;

  const navItems = [
    { path: '/', icon: Home, label: 'Посылки' },
    { path: '/create', icon: PlusCircle, label: 'Создать' },
    { path: '/profile', icon: User, label: 'Профиль' },
    ...(user.isAdmin ? [{ path: '/admin', icon: Shield, label: 'Админ' }] : []),
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-dark-950 pb-24">
      <div className="bg-animated" />

      {/* Header with blur */}
      <header className="sticky top-0 z-50 glass-blur border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-lg font-bold font-logo tracking-wider">
              <span className="text-red-500">kb</span>
              <span className="text-white">post</span>
            </span>
          </div>
          <div
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/profile')}
          >
            <span className="text-sm text-dark-300 font-medium hidden sm:block">{user.username}</span>
            <img
              src={`https://mc-heads.net/avatar/${user.username}/36`}
              alt={user.username}
              className="w-9 h-9 rounded-xl ring-2 ring-red-500/30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.username}&background=dc2626&color=fff&size=36`;
              }}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Dock-style bottom navigation */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
        <nav className="glass-blur rounded-2xl border border-white/10">
          <div className="flex">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`relative flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-200 ${
                    isActive ? 'text-red-500' : 'text-dark-400 hover:text-dark-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute top-0 w-10 h-0.5 bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
