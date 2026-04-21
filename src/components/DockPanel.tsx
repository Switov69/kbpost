import type { AppPage } from '../types';
import { IconPackage, IconPlus, IconSettings } from './Icons';

interface DockPanelProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

const tabs: { id: AppPage; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: 'parcels',
    label: 'Посылки',
    icon: (active) => <IconPackage size={22} color={active ? '#F5C518' : '#80848e'} />,
  },
  {
    id: 'create',
    label: 'Создать',
    icon: (active) => <IconPlus size={22} color={active ? '#F5C518' : '#80848e'} />,
  },
  {
    id: 'settings',
    label: 'Профиль',
    icon: (active) => <IconSettings size={22} color={active ? '#F5C518' : '#80848e'} />,
  },
];

export function DockPanel({ currentPage, onNavigate }: DockPanelProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center z-50"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', padding: '0 16px max(16px, env(safe-area-inset-bottom))' }}
    >
      <div
        className="liquid-glass-strong flex items-center gap-1 px-3 py-2"
        style={{
          borderRadius: '28px',
          minWidth: '260px',
          maxWidth: '360px',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '28px',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '28px',
            background: 'radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {tabs.map((tab) => {
          const isActive = currentPage === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`dock-btn flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all ${isActive ? 'active' : ''}`}
              style={{
                background: isActive ? 'rgba(245,197,24,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(245,197,24,0.2)' : '1px solid transparent',
                minHeight: '54px',
                cursor: 'pointer',
              }}
            >
              {tab.icon(isActive)}
              <span
                className="text-xs font-semibold"
                style={{
                  color: isActive ? '#F5C518' : '#80848e',
                  fontSize: '10px',
                  letterSpacing: '0.3px',
                  transition: 'color 0.2s',
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-1px',
                    width: '20px',
                    height: '3px',
                    background: '#F5C518',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
