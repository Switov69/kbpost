import { useState } from 'react';
import type { UserProfile, CreateParcelData } from '../types';
import { createParcel, getUserByNickname } from '../api';
import { BRANCHES, CITIZENSHIP_LABELS, getBranchLabel } from '../data/branches';
import { IconArrowLeft, IconArrowRight, IconCheck, IconUser } from '../components/Icons';

interface CreatePageProps {
  user: UserProfile;
  onCreated: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS_LABELS = ['Получатель', 'Описание', 'Откуда', 'Куда', 'Проверка'];

export function CreatePage({ user, onCreated }: CreatePageProps) {
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<Partial<CreateParcelData>>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdTTN, setCreatedTTN] = useState('');

  const handleNext = async () => {
    setError('');
    if (step === 1) {
      if (!data.receiver_nickname?.trim()) { setError('Укажите никнейм получателя'); return; }
      if (data.receiver_nickname.toLowerCase() === user.nickname.toLowerCase()) {
        setError('Нельзя отправить самому себе'); return;
      }
      setIsLoading(true);
      try {
        const receiver = await getUserByNickname(data.receiver_nickname);
        if (!receiver) { setError('Пользователь не найден'); setIsLoading(false); return; }
      } catch {
        setError('Ошибка проверки пользователя'); setIsLoading(false); return;
      }
      setIsLoading(false);
    }
    if (step === 2) {
      if (!data.description?.trim()) { setError('Укажите описание посылки'); return; }
      if (data.description.length > 300) { setError('Описание слишком длинное (макс. 300 символов)'); return; }
    }
    if (step === 3) {
      if (!data.from_branch) { setError('Выберите отделение отправки'); return; }
    }
    if (step === 4) {
      if (!data.to_branch) { setError('Выберите отделение доставки'); return; }
      if (data.from_branch === data.to_branch) { setError('Отделения должны различаться'); return; }
    }
    if (step === 5) {
      setIsLoading(true);
      try {
        const parcel = await createParcel(user.telegram_id, data as CreateParcelData);
        setCreatedTTN(parcel.ttn);
        setSuccess(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ошибка создания посылки');
      } finally {
        setIsLoading(false);
      }
      return;
    }
    setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    setError('');
    if (step === 1) return;
    setStep((s) => (s - 1) as Step);
  };

  if (success) {
    return (
      <div className="page-content flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 slide-up"
          style={{ background: 'rgba(87,242,135,0.15)', border: '2px solid rgba(87,242,135,0.3)' }}
        >
          <IconCheck size={36} color="#57f287" />
        </div>
        <h2 className="text-2xl font-bold mb-2 slide-up" style={{ color: 'var(--text-primary)', animationDelay: '0.05s' }}>
          Посылка создана!
        </h2>
        <div className="mb-2 slide-up" style={{ animationDelay: '0.1s' }}>
          <span className="text-3xl font-black" style={{ color: '#F5C518', fontFamily: 'monospace' }}>{createdTTN}</span>
        </div>
        <p className="text-sm mb-8 slide-up" style={{ color: 'var(--text-muted)', animationDelay: '0.15s' }}>
          Это ваш номер накладной. Получатель уже видит посылку в своём списке.
        </p>
        <button
          className="btn-accent w-full slide-up"
          style={{ animationDelay: '0.2s' }}
          onClick={() => {
            setStep(1);
            setData({});
            setSuccess(false);
            setCreatedTTN('');
            onCreated();
          }}
        >
          Готово
        </button>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-4">
          {step > 1 && (
            <button onClick={handleBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <IconArrowLeft size={16} color="var(--text-secondary)" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {step === 5 ? 'Проверка' : 'Новая посылка'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Шаг {step} из 5 · {STEPS_LABELS[step - 1]}
            </p>
          </div>
        </div>

        <div className="step-indicator mb-6">
          {STEPS_LABELS.map((_, i) => (
            <div
              key={i}
              className={`step-dot ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="px-4 fade-in" key={step}>
        {step === 1 && (
          <div>
            <div
              className="card p-4 mb-4"
              style={{ background: 'rgba(245,197,24,0.05)', borderColor: 'rgba(245,197,24,0.2)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <IconUser size={14} color="#F5C518" />
                <span className="text-xs font-semibold" style={{ color: '#F5C518' }}>Отправитель (вы)</span>
              </div>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>@{user.nickname}</span>
            </div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              Никнейм получателя
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>@</span>
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '26px' }}
                placeholder="nickname"
                value={data.receiver_nickname || ''}
                onChange={e => setData(d => ({ ...d, receiver_nickname: e.target.value }))}
                autoFocus
              />
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Введите точный никнейм игрока на сервере
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              Описание содержимого
            </label>
            <textarea
              className="input-field"
              style={{ minHeight: '120px', resize: 'none' }}
              placeholder="Что находится в посылке? Например: 64 алмаза, зачарованная кирка..."
              value={data.description || ''}
              onChange={e => setData(d => ({ ...d, description: e.target.value }))}
              maxLength={300}
              autoFocus
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {(data.description || '').length}/300
              </span>
            </div>
          </div>
        )}

        {(step === 3 || step === 4) && (
          <div>
            <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
              {step === 3 ? 'Откуда отправляем' : 'Куда доставить'}
            </label>

            {(['capital', 'antegiya'] as const).map(city => (
              <div key={city} className="mb-4">
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  {CITIZENSHIP_LABELS[city]}
                </div>
                <div className="space-y-2">
                  {BRANCHES.filter(b => b.city === city).map(branch => {
                    const fieldKey = step === 3 ? 'from_branch' : 'to_branch';
                    const isSelected = data[fieldKey] === branch.id;
                    return (
                      <button
                        key={branch.id}
                        onClick={() => setData(d => ({ ...d, [fieldKey]: branch.id }))}
                        className="w-full text-left p-3 rounded-xl transition-all"
                        style={{
                          background: isSelected ? 'rgba(245,197,24,0.1)' : 'var(--bg-secondary)',
                          border: `1px solid ${isSelected ? '#F5C518' : 'var(--border)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-sm" style={{ color: isSelected ? '#F5C518' : 'var(--text-primary)' }}>
                              {branch.name}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{branch.address}</div>
                          </div>
                          {isSelected && <IconCheck size={16} color="#F5C518" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="card p-4">
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Информация о посылке</div>
              <InfoRow label="От" value={`@${user.nickname}`} />
              <InfoRow label="Кому" value={`@${data.receiver_nickname}`} />
              <InfoRow label="Описание" value={data.description || ''} />
              <InfoRow label="Откуда" value={getBranchLabel(data.from_branch || '')} />
              <InfoRow label="Куда" value={getBranchLabel(data.to_branch || '')} />
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.2)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ⚡ После отправки посылка появится у получателя. ТТН присваивается автоматически.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: 'rgba(240,71,71,0.1)', border: '1px solid rgba(240,71,71,0.3)', color: '#f04747' }}>
            {error}
          </div>
        )}

        <button
          className="btn-accent w-full mt-6"
          onClick={handleNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1a1a1a', borderTopColor: 'transparent' }} />
          ) : step === 5 ? (
            <><IconCheck size={18} /> Отправить посылку</>
          ) : (
            <>Далее <IconArrowRight size={16} /></>
          )}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm flex-shrink-0 mr-4" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
