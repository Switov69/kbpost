import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useToast, notifyParcelCreated } from '../context';
import { createParcel, getBranches } from '../db';
import { Branch, getBranchDisplay } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Package, MapPin, CreditCard,
  CheckCircle, XCircle, User, FileText, Navigation, RotateCcw,
  Sparkles
} from 'lucide-react';

type Step = 'info' | 'from' | 'to' | 'services' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'info', label: 'Информация' },
  { key: 'from', label: 'Откуда' },
  { key: 'to', label: 'Куда' },
  { key: 'services', label: 'Услуги' },
  { key: 'review', label: 'Проверка' },
];

export default function CreatePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [description, setDescription] = useState('');
  const [receiverUsername, setReceiverUsername] = useState('');
  const [receiverValid, setReceiverValid] = useState<boolean | null>(null);
  const [receiverChecked, setReceiverChecked] = useState(false);
  const [fromBranch, setFromBranch] = useState<Branch | null>(null);
  const [fromRegionFilter, setFromRegionFilter] = useState<string>('Столица');
  const [deliveryType, setDeliveryType] = useState<'branch' | 'coords'>('branch');
  const [toBranch, setToBranch] = useState<Branch | null>(null);
  const [toRegionFilter, setToRegionFilter] = useState<string>('Столица');
  const [toCoordinates, setToCoordinates] = useState('');
  const [cashOnDelivery, setCashOnDelivery] = useState(false);
  const [cashOnDeliveryAmount, setCashOnDeliveryAmount] = useState('');

  const branches = useMemo(() => getBranches(), []);
  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  const checkReceiver = () => {
    const username = receiverUsername.trim();
    if (!username) {
      setReceiverValid(false);
      setReceiverChecked(true);
      return;
    }
    if (username.toLowerCase() === user?.username.toLowerCase()) {
      addToast('Нельзя отправить посылку самому себе', 'error');
      setReceiverValid(false);
      setReceiverChecked(true);
      return;
    }
    // Force fresh read from localStorage to avoid any stale data
    const allUsers = JSON.parse(localStorage.getItem('kbpost_users') || '[]');
    const found = allUsers.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
    setReceiverValid(!!found);
    setReceiverChecked(true);
    if (!found) {
      addToast('Пользователь не найден', 'error');
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'info':
        return !!description.trim() && receiverValid === true;
      case 'from':
        return !!fromBranch;
      case 'to':
        if (deliveryType === 'branch') return !!toBranch;
        return !!toCoordinates.trim();
      case 'services':
        return !cashOnDelivery || (!!cashOnDeliveryAmount && Number(cashOnDeliveryAmount) > 0);
      default:
        return true;
    }
  };

  const nextStep = () => {
    const idx = STEPS.findIndex(s => s.key === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].key);
  };

  const prevStep = () => {
    const idx = STEPS.findIndex(s => s.key === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].key);
  };

  const handleCreate = () => {
    if (!user) return;
    // Force fresh read from localStorage
    const allUsers = JSON.parse(localStorage.getItem('kbpost_users') || '[]');
    const receiver = allUsers.find((u: any) => u.username.toLowerCase() === receiverUsername.trim().toLowerCase());
    if (!receiver || !fromBranch) return;

    const parcel = createParcel({
      description,
      senderId: user.id,
      receiverId: receiver.id,
      senderUsername: user.username,
      receiverUsername: receiver.username,
      fromBranchId: fromBranch.id,
      toBranchId: deliveryType === 'branch' ? toBranch?.id || null : null,
      toCoordinates: deliveryType === 'coords' ? toCoordinates : null,
      cashOnDelivery,
      cashOnDeliveryAmount: cashOnDelivery ? Number(cashOnDeliveryAmount) : 0,
    });

    // Уведомляем обоих пользователей через Telegram бота
    notifyParcelCreated(
      user.telegramUsername,
      receiver.telegramUsername,
      parcel.ttn
    );
    addToast(`Посылка создана! ТТН: ${parcel.ttn} 📦`, 'success');
    navigate('/');
  };

  const handleReset = () => {
    setCurrentStep('info');
    setDescription('');
    setReceiverUsername('');
    setReceiverValid(null);
    setReceiverChecked(false);
    setFromBranch(null);
    setDeliveryType('branch');
    setToBranch(null);
    setToCoordinates('');
    setCashOnDelivery(false);
    setCashOnDeliveryAmount('');
  };

  const handleCoordsChange = (value: string) => {
    const cleaned = value.replace(/[^0-9\-.,\s]/g, '');
    setToCoordinates(cleaned);
  };

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setCashOnDeliveryAmount(cleaned);
  };

  const renderBranchItem = (branch: Branch, selected: boolean, onSelect: () => void) => {
    const display = getBranchDisplay(branch);
    return (
      <button
        key={branch.id}
        onClick={onSelect}
        className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
          selected
            ? 'bg-red-500/15 border border-red-500/30 ring-1 ring-red-500/20'
            : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold ${
            selected ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-dark-300'
          }`}>
            {branch.number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{display.line1}</p>
            <p className="text-xs text-dark-400">{display.line2}</p>
          </div>
          {selected && (
            <CheckCircle size={18} className="text-red-400 ml-auto flex-shrink-0" />
          )}
        </div>
      </button>
    );
  };

  const getFromBranchDisplay = () => {
    if (!fromBranch) return '';
    const d = getBranchDisplay(fromBranch);
    return `${d.line1}\n${d.line2}`;
  };

  const getToBranchDisplay = () => {
    if (deliveryType === 'coords') return `Координаты: ${toCoordinates}`;
    if (!toBranch) return '';
    const d = getBranchDisplay(toBranch);
    return `${d.line1}\n${d.line2}`;
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="glass-card-static p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-white">Новая посылка</h2>
          <span className="text-xs text-dark-400">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= stepIndex
                  ? 'bg-red-500'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-dark-400 mt-2">{STEPS[stepIndex].label}</p>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step: Info */}
          {currentStep === 'info' && (
            <div className="glass-card-static p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={18} className="text-red-500" />
                <h3 className="font-bold">Описание и получатель</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Описание посылки</label>
                <textarea
                  className="input-dark"
                  placeholder="Опишите содержимое посылки..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Никнейм получателя</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className="input-dark pr-10"
                      placeholder="Введите никнейм"
                      value={receiverUsername}
                      onChange={e => {
                        setReceiverUsername(e.target.value);
                        setReceiverValid(null);
                        setReceiverChecked(false);
                      }}
                    />
                    {receiverChecked && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {receiverValid ? (
                          <CheckCircle size={18} className="text-green-400" />
                        ) : (
                          <XCircle size={18} className="text-red-400" />
                        )}
                      </span>
                    )}
                  </div>
                  <button onClick={checkReceiver} className="btn-secondary flex-shrink-0">
                    <User size={16} />
                    Проверить
                  </button>
                </div>
                {receiverChecked && receiverValid && (
                  <p className="text-xs text-green-400 mt-1.5">✓ Пользователь найден</p>
                )}
                {receiverChecked && !receiverValid && (
                  <p className="text-xs text-red-400 mt-1.5">✗ Пользователь не найден</p>
                )}
              </div>
            </div>
          )}

          {/* Step: From Branch */}
          {currentStep === 'from' && (
            <div className="glass-card-static p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} className="text-red-500" />
                <h3 className="font-bold">Отделение отправки</h3>
              </div>
              <p className="text-sm text-dark-400">Выберите отделение, из которого отправляете посылку</p>

              {/* Region filter */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
                {['Столица', 'Антегрия'].map(region => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setFromRegionFilter(region)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      fromRegionFilter === region
                        ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20'
                        : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {branches.filter(b => b.region === fromRegionFilter).map(branch =>
                  renderBranchItem(branch, fromBranch?.id === branch.id, () => setFromBranch(branch))
                )}
                {branches.filter(b => b.region === fromRegionFilter).length === 0 && (
                  <p className="text-sm text-dark-400 text-center py-4">Нет доступных отделений</p>
                )}
              </div>
            </div>
          )}

          {/* Step: To */}
          {currentStep === 'to' && (
            <div className="glass-card-static p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Navigation size={18} className="text-red-500" />
                <h3 className="font-bold">Место доставки</h3>
              </div>

              <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
                <button
                  onClick={() => { setDeliveryType('branch'); setToCoordinates(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    deliveryType === 'branch'
                      ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Отделения
                </button>
                <button
                  onClick={() => { setDeliveryType('coords'); setToBranch(null); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    deliveryType === 'coords'
                      ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  На координаты
                </button>
              </div>

              <AnimatePresence mode="wait">
                {deliveryType === 'branch' ? (
                  <motion.div
                    key="branches"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    {/* Region filter */}
                    <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
                      {['Столица', 'Антегрия'].map(region => (
                        <button
                          key={region}
                          type="button"
                          onClick={() => setToRegionFilter(region)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                            toRegionFilter === region
                              ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20'
                              : 'text-dark-400 hover:text-white'
                          }`}
                        >
                          {region}
                        </button>
                      ))}
                    </div>
                    {branches.filter(b => b.region === toRegionFilter && b.id !== fromBranch?.id).map(branch =>
                      renderBranchItem(branch, toBranch?.id === branch.id, () => setToBranch(branch))
                    )}
                    {branches.filter(b => b.region === toRegionFilter && b.id !== fromBranch?.id).length === 0 && (
                      <p className="text-sm text-dark-400 text-center py-4">Нет доступных отделений</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="coords"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Координаты доставки (X, Y, Z)
                    </label>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="Пример: 100, 64, -200"
                      value={toCoordinates}
                      onChange={e => handleCoordsChange(e.target.value)}
                    />
                    <p className="text-xs text-dark-500 mt-1.5">
                      Только цифры, минус (-), точка (.) и запятая (,)
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Step: Services */}
          {currentStep === 'services' && (
            <div className="glass-card-static p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-red-500" />
                <h3 className="font-bold">Дополнительные услуги</h3>
              </div>

              <div className={`p-4 rounded-xl transition-all duration-200 ${
                cashOnDelivery
                  ? 'bg-orange-500/10 border border-orange-500/25'
                  : 'bg-white/5 border border-white/5'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className={cashOnDelivery ? 'text-orange-400' : 'text-dark-400'} />
                    <div>
                      <p className="text-sm font-semibold">Наложенный платёж</p>
                      <p className="text-xs text-dark-400">Получатель оплачивает перед получением</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setCashOnDelivery(!cashOnDelivery); setCashOnDeliveryAmount(''); }}
                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${
                      cashOnDelivery ? 'bg-orange-500' : 'bg-white/20'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-300 ${
                      cashOnDelivery ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                <AnimatePresence>
                  {cashOnDelivery && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 overflow-hidden"
                    >
                      <label className="block text-sm font-medium text-dark-300 mb-2">Сумма (кбк)</label>
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="Введите сумму"
                        value={cashOnDeliveryAmount}
                        onChange={e => handleAmountChange(e.target.value)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {currentStep === 'review' && (
            <div className="glass-card-static p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Package size={18} className="text-red-500" />
                <h3 className="font-bold">Проверьте данные</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-dark-400">Описание</span>
                  <span className="text-sm font-medium text-right max-w-[60%] truncate">{description}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-dark-400">Получатель</span>
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://mc-heads.net/avatar/${receiverUsername}/24`}
                      alt={receiverUsername}
                      className="w-6 h-6 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${receiverUsername}&background=dc2626&color=fff&size=24`;
                      }}
                    />
                    <span className="text-sm font-medium">{receiverUsername}</span>
                  </div>
                </div>
                <div className="py-2 border-b border-white/5">
                  <span className="text-sm text-dark-400">Откуда</span>
                  <p className="text-sm font-medium mt-1 whitespace-pre-line">{getFromBranchDisplay()}</p>
                </div>
                <div className="py-2 border-b border-white/5">
                  <span className="text-sm text-dark-400">Куда</span>
                  <p className="text-sm font-medium mt-1 whitespace-pre-line">{getToBranchDisplay()}</p>
                </div>
                {cashOnDelivery && (
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-dark-400">Наложенный платёж</span>
                    <span className="text-sm font-bold text-orange-400">{cashOnDeliveryAmount} кбк</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleReset} className="btn-secondary flex-1">
                  <RotateCcw size={16} />
                  Заново
                </button>
                <button onClick={handleCreate} className="btn-primary flex-1">
                  <Package size={16} />
                  Создать
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      {currentStep !== 'review' && (
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <button onClick={prevStep} className="btn-secondary flex-1">
              <ArrowLeft size={16} />
              Назад
            </button>
          )}
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="btn-primary flex-1"
          >
            Далее
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
