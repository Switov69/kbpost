import { useState, useEffect, useCallback } from 'react';
import type { TelegramUser, Citizenship } from '../types';
import { registerUser, checkNicknameAvailable } from '../api';
import type { UserProfile } from '../types';
import { IconArrowRight, IconCheck, IconDelete, IconLogo } from '../components/Icons';
import { CITIZENSHIP_LABELS } from '../data/branches';

interface RegisterPageProps {
  telegramUser: TelegramUser;
  onRegistered: (profile: UserProfile) => void;
}

type RegStep = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Никнейм', 'Гражданство', 'Счёт', 'Пароль'];
const PIN_LENGTH = 4;

export function RegisterPage({ telegramUser, onRegistered }: RegisterPageProps) {
  const [step, setStep] = useState<RegStep>(1);
  const [nickname, setNickname] = useState('');
  const [citizenship, setCitizenship] = useState<Citizenship | ''>('');
  const [bankAccount, setBankAccount] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isPinConfirm, setIsPinConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    setError('');
    if (step === 1) {
      if (!nickname.trim()) { setError('Введите никнейм'); return; }
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(nickname)) { setError('Никнейм: 3–24 символа, только буквы, цифры, _'); return; }
      setIsLoading(true);
      try {
        const available = await checkNicknameAvailable(nickname);
        if (!available) { setError('Никнейм уже занят'); setIsLoading(false); return; }
      } catch { setError('Ошибка проверки'); setIsLoading(false); return; }
      setIsLoading(false);
    }
    if (step === 2) {
      if (!citizenship) { setError('Выберите гражданство'); return; }
    }
    if (step === 3) {
      if (!bankAccount.trim()) { setError('Введите банковский счёт'); return; }
    }
    if (step < 4) { setStep((s) => (s + 1) as RegStep); return; }
  };

  const handleDigit = useCallback((d: string) => {
    if (isPinConfirm) {
      setConfirmPin(prev => {
        if (prev.length >= PIN_LENGTH) return prev;
        return prev + d;
      });
    } else {
      setPin(prev => {
        if (prev.length >= PIN_LENGTH) return prev;
        return prev + d;
      });
    }
  }, [isPinConfirm]);

  const handleBackspace = useCallback(() => {
    if (isPinConfirm) setConfirmPin(p => p.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  }, [isPinConfirm]);

  useEffect(() => {
    if (step !== 4) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleBackspace();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, handleDigit, handleBackspace]);

  useEffect(() => {
    if (step !== 4) return;
    if (!isPinConfirm && pin.length === PIN_LENGTH) {
      setTimeout(() => setIsPinConfirm(true), 200);
    }
    if (isPinConfirm && confirmPin.length === PIN_LENGTH) {
      if (pin !== confirmPin) {
        setError('Коды не совпадают');
        setConfirmPin('');
        setTimeout(() => { setIsPinConfirm(false); setPin(''); setError(''); }, 1200);
        return;
      }
      setError('');
      handleRegister(pin);
    }
  }, [pin, confirmPin, isPinConfirm, step]);

  const handleRegister = async (pinCode: string) => {
    setIsLoading(true);
    try {
      const profile = await registerUser(
        telegramUser.id,
        nickname,
        citizenship as Citizenship,
        bankAccount,
        pinCode
      );
      onRegistered(profile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка регистрации');
      setPin(''); setConfirmPin(''); setIsPinConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const currentPin = isPinConfirm ? confirmPin : pin;
  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <IconLogo size={36} />
            <div>
              <div className="text-xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>KBPOST</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Регистрация</div>
            </div>
          </div>

          <div className="step-indicator mb-6">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`step-dot ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}`} />
            ))}
          </div>

          <div className="fade-in" key={step}>
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Привет, {telegramUser.first_name}!</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Придумайте никнейм для KBPOST. Это ваш адрес для получения посылок.</p>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Никнейм</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Например: Steve123"
                  value={nickname}
                  onChange={e => setNickname(e.target.value.trim())}
                  autoFocus
                  maxLength={24}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>3–24 символа: буквы, цифры, подчёркивание</p>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Гражданство</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Укажите, жителем какого города вы являетесь.</p>
                <div className="space-y-3">
                  {(['capital', 'antegiya'] as Citizenship[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setCitizenship(c)}
                      className="w-full p-4 rounded-xl text-left transition-all"
                      style={{
                        background: citizenship === c ? 'rgba(245,197,24,0.1)' : 'var(--bg-secondary)',
                        border: `1.5px solid ${citizenship === c ? '#F5C518' : 'var(--border)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-base" style={{ color: citizenship === c ? '#F5C518' : 'var(--text-primary)' }}>
                            {CITIZENSHIP_LABELS[c]}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {c === 'capital' ? 'Жители столицы' : 'Жители Антегии'}
                          </div>
                        </div>
                        {citizenship === c && <IconCheck size={18} color="#F5C518" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Банковский счёт</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Укажите номер вашего игрового банковского счёта. Он будет виден при транзакциях.</p>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Номер счёта</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Например: KB-0001234"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {isPinConfirm ? 'Повторите пароль' : 'Создайте пароль'}
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                  {isPinConfirm ? 'Введите пароль ещё раз для подтверждения' : 'Придумайте 4-значный код — он потребуется при каждом входе'}
                </p>

                <div className="flex gap-3 justify-center mb-2">
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <div
                      key={i}
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200"
                      style={{
                        background: i < currentPin.length ? '#F5C518' : 'var(--bg-secondary)',
                        border: `2px solid ${i < currentPin.length ? '#F5C518' : 'var(--border)'}`,
                        transform: i < currentPin.length ? 'scale(1.08)' : 'scale(1)',
                      }}
                    >
                      {i < currentPin.length && <div className="w-3 h-3 rounded-full" style={{ background: '#1a1a1a' }} />}
                    </div>
                  ))}
                </div>

                {error && (
                  <p className="text-center text-sm mb-3" style={{ color: '#f04747' }}>{error}</p>
                )}
                {!error && <div className="mb-3 h-5" />}

                <div className="grid grid-cols-3 gap-3 mt-2">
                  {digits.map((d, i) => {
                    if (d === '') return <div key={i} />;
                    if (d === '⌫') return (
                      <button key={i} className="number-pad-btn" onPointerDown={handleBackspace} disabled={isLoading}>
                        <IconDelete size={20} />
                      </button>
                    );
                    return (
                      <button key={i} className="number-pad-btn" onPointerDown={() => handleDigit(d)} disabled={isLoading}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && step !== 4 && (
              <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: 'rgba(240,71,71,0.1)', border: '1px solid rgba(240,71,71,0.3)', color: '#f04747' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {step < 4 && (
        <div className="px-5 pb-6 pt-2">
          {isLoading ? (
            <div className="flex justify-center py-3">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#F5C518', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <button className="btn-accent w-full" onClick={handleNext}>
              Далее <IconArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      {step === 4 && isLoading && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#F5C518', borderTopColor: 'transparent' }} />
        </div>
      )}
    </div>
  );
}
