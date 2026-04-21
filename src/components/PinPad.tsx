import { useState, useEffect, useCallback } from 'react';
import { IconDelete } from './Icons';

interface PinPadProps {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onError?: string;
  isLoading?: boolean;
}

const PIN_LENGTH = 4;

export function PinPad({ title, subtitle, onComplete, onError, isLoading }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const handleDigit = useCallback((d: string) => {
    setPin(prev => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + d;
      if (next.length === PIN_LENGTH) {
        setTimeout(() => onComplete(next), 80);
      }
      return next;
    });
  }, [onComplete]);

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    if (onError) {
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  }, [onError]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleBackspace();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDigit, handleBackspace]);

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(245,197,24,0.15)', border: '1px solid rgba(245,197,24,0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {subtitle && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>

        <div className={`flex gap-3 justify-center mb-2 ${shake ? 'animate-bounce' : ''}`} style={shake ? { animation: 'shake 0.4s ease' } : {}}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                background: i < pin.length ? '#F5C518' : 'var(--bg-secondary)',
                border: `2px solid ${i < pin.length ? '#F5C518' : 'var(--border)'}`,
                transform: i < pin.length ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              {i < pin.length && (
                <div className="w-3 h-3 rounded-full" style={{ background: '#1a1a1a' }} />
              )}
            </div>
          ))}
        </div>

        {onError && (
          <p className="text-center text-sm mb-4 mt-2" style={{ color: '#f04747' }}>
            {onError}
          </p>
        )}
        {!onError && <div className="mb-4 mt-2 h-5" />}

        <div className="grid grid-cols-3 gap-3 mt-4">
          {digits.map((d, i) => {
            if (d === '') return <div key={i} />;
            if (d === '⌫') return (
              <button
                key={i}
                className="number-pad-btn"
                onPointerDown={handleBackspace}
                disabled={isLoading}
              >
                <IconDelete size={20} />
              </button>
            );
            return (
              <button
                key={i}
                className="number-pad-btn"
                onPointerDown={() => handleDigit(d)}
                disabled={isLoading}
              >
                {d}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex justify-center mt-6">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#F5C518', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
