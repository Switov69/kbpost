import { useEffect, useMemo, useRef, useState } from "react";
import { kbApi } from "./api";

/* KBPOST — Telegram Mini App (Yandex-style)
   Часть 3/4: Полная интеграция с Neon Postgres через API
*/

type Citizenship = "Столица" | "Антегрия";
type ParcelStatus = "Создана" | "В пути" | "В отделении" | "Ожидает оплату" | "Выдана" | "Отклонена";

interface User {
  id: string;
  nickname: string;
  tgId?: string;
  tgUsername?: string;
  avatarUrl?: string;
  citizenship?: Citizenship;
  bankAccount?: string;
  pin?: string;
  isAdmin?: boolean;
  createdAt: number;
}

interface Parcel {
  id: string;
  description: string;
  senderId: string;
  senderNickname?: string;
  recipientId: string;
  recipientNickname?: string;
  fromBranchId: string;
  fromBranchName?: string;
  toBranchId: string;
  toBranchName?: string;
  codEnabled: boolean;
  codAmount?: number;
  codPaid?: boolean;
  status: ParcelStatus;
  createdAt: number;
  updatedAt: number;
}

interface Branch {
  id: string;
  name: string;
  city: Citizenship;
}

const Y = {
  yellow: "#FFCC00",
  black: "#000000",
  gray900: "#1a1b22",
  gray500: "#6b7280",
  gray400: "#9aa0a6",
  white: "#ffffff",
  green: "#1bb74a",
  red: "#ff3b30",
  blue: "#1a73e8",
};

const cn = (...cls: (string | false | undefined | null)[]) => cls.filter(Boolean).join(" ");

const uuid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function skinUrlByNick(nick: string) {
  const n = encodeURIComponent(nick.trim());
  return `https://minotar.net/avatar/${n}/128`;
}

function copy(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {}
}

const tg = (window as any).Telegram?.WebApp;

function tmaHaptic(type: "light" | "medium" | "heavy" = "light") {
  try { tg?.HapticFeedback?.impactOccurred?.(type); } catch {}
}
function tmaClose() {
  try { tg?.close?.(); } catch {}
}
function tmaReady() {
  try { tg?.ready?.(); tg?.expand?.(); } catch {}
}

/* ---------- UI primitives ---------- */
function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[960px] px-3 sm:px-4">{children}</div>;
}
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[20px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)] border border-[#e9eaee]",
        className
      )}
    >
      {children}
    </div>
  );
}
function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-4 h-11 text-[15px] font-medium transition active:scale-[0.99] select-none";
  const styles = {
    primary: "bg-[#FFCC00] text-black hover:brightness-[0.97] disabled:opacity-50",
    ghost: "bg-transparent text-[#1a1b22] hover:bg-[#f5f6f8] border border-[#e5e7eb]",
    danger: "bg-[#111] text-white hover:opacity-90",
    soft: "bg-[#f6f7f9] text-[#1a1b22] hover:bg-[#eef0f3] border border-[#e9eaee]",
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cn(base, styles, className)}>
      {children}
    </button>
  );
}
function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }
) {
  const { label, hint, className, ...rest } = props;
  return (
    <div className="w-full">
      {label && <div className="mb-1.5 text-[13px] text-[#5f6368]">{label}</div>}
      <input
        {...rest}
        className={cn(
          "h-11 w-full rounded-[12px] border border-[#e1e3e8] bg-white px-3.5 text-[15px] outline-none",
          "focus:border-[#1a73e8] focus:ring-4 focus:ring-[#1a73e81a]",
          className
        )}
      />
      {hint && <div className="mt-1 text-[12px] text-[#7a7f87]">{hint}</div>}
    </div>
  );
}
function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={cn(
        "h-8 rounded-full px-3 inline-flex items-center text-[13px] border",
        active ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#1a1b22] border-[#e5e7eb]"
      )}
    >
      {children}
    </div>
  );
}
function Divider() {
  return <div className="h-px w-full bg-[#eceef2]" />;
}

/* ---------- Header ---------- */
function YandexHeader({ nickname, avatar }: { nickname?: string; avatar?: string }) {
  return (
    <div className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-[#eceef2]">
      <Container>
        <div className="flex h-[56px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-[10px] grid place-items-center" style={{ background: Y.yellow }}>
              <span className="text-[18px] font-black tracking-tight">KB</span>
            </div>
            <div className="leading-tight">
              <div className="text-[18px] font-semibold tracking-tight">KBPOST</div>
              <div className="text-[11px] text-[#6b7280] -mt-0.5">виртуальная почта сервера</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nickname ? (
              <>
                <div className="hidden sm:block text-[13px] text-[#4b5563]">{nickname}</div>
                <img
                  src={avatar || skinUrlByNick(nickname)}
                  alt=""
                  className="h-8 w-8 rounded-full border border-[#e5e7eb] object-cover"
                />
              </>
            ) : (
              <Chip>Гость</Chip>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

/* ---------- Tabs ---------- */
type TabKey = "parcels" | "create" | "settings";
function Tabs({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const items: { k: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      k: "parcels",
      label: "Посылки",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 7l9-4 9 4-9 4-9-4zM3 17l9 4 9-4M3 12l9 4 9-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ),
    },
    {
      k: "create",
      label: "Создать",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      ),
    },
    {
      k: "settings",
      label: "Настройки",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8"/><path d="M19.4 15a7.96 7.96 0 000-6l2.1-1.2-2-3.5-2.4.8a7.9 7.9 0 00-5.2-3v-2.4h-4v2.4a7.9 7.9 0 00-5.2 3l-2.4-.8-2 3.5 2.1 1.2a7.96 7.96 0 000 6L.3 16.2l2 3.5 2.4-.8a7.9 7.9 0 005.2 3v2.4h4v-2.4a7.9 7.9 0 005.2-3l2.4.8 2-3.5-2.1-1.2z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
      ),
    },
  ];
  return (
    <div className="sticky top-[56px] z-30 border-b border-[#eceef2] bg-[#fafafa]">
      <Container>
        <div className="flex items-center gap-2 py-2">
          {items.map((it) => (
            <button
              key={it.k}
              onClick={() => setTab(it.k)}
              className={cn(
                "h-10 rounded-full px-3.5 inline-flex items-center gap-2 text-[14px] border transition",
                tab === it.k
                  ? "bg-black text-white border-black"
                  : "bg-white text-[#1a1b22] border-[#e5e7eb] hover:bg-[#f5f6f8]"
              )}
            >
              <span className="opacity-90">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      </Container>
    </div>
  );
}

/* ---------- App State ---------- */
function useAppData() {
  const [user, setUser] = useState<User | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshParcels = async (userId: string) => {
    const data = await kbApi.listParcels(userId);
    setParcels(data);
  };

  const refreshBranches = async () => {
    const data = await kbApi.listBranches();
    setBranches(data);
  };

  const refreshUsers = async () => {
    try {
      const data = await kbApi.listUsers();
      setUsers(data);
    } catch {}
  };

  return {
    user, setUser,
    parcels, setParcels, refreshParcels,
    branches, setBranches, refreshBranches,
    users, setUsers, refreshUsers,
    loading, setLoading,
  };
}

/* ---------- Registration ---------- */
function RegistrationFlow({ onRegistered }: { onRegistered: (u: User) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [citizenship, setCitizenship] = useState<Citizenship>("Столица");
  const [bank, setBank] = useState("");
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const pending = localStorage.getItem("kbpost_pending_reg");
    if (pending) {
      try {
        const { nickname: nn, token: tk, userId: uid } = JSON.parse(pending);
        setNickname(nn);
        setToken(tk);
        setUserId(uid);
        setStep(2);
        checkToken(tk);
      } catch {}
    }
  }, []);

  const checkToken = async (tk: string) => {
    setChecking(true);
    try {
      const tok = await kbApi.getLinkToken(tk);
      if (tok && !tok.used && tok.expires_at > Date.now()) {
        const interval = setInterval(async () => {
          try {
            const updated = await kbApi.getLinkToken(tk);
            if (updated.used) {
              clearInterval(interval);
              setStep(3);
              localStorage.removeItem("kbpost_pending_reg");
            }
          } catch {}
        }, 2000);
        setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
      }
    } catch {}
    setChecking(false);
  };

  const genToken = async () => {
    if (!nickname.trim()) return;
    const uid = uuid();
    setUserId(uid);
    try {
      const res = await kbApi.createLinkToken(uid, nickname.trim());
      setToken(res.token);
      localStorage.setItem("kbpost_pending_reg", JSON.stringify({ nickname: nickname.trim(), token: res.token, userId: uid }));
      copy(`/link ${res.token}`);
      setTimeout(() => tmaClose(), 300);
      checkToken(res.token);
    } catch (e) {
      alert("Ошибка создания токена");
    }
  };

  const finish = async () => {
    if (!token || !userId) return;
    if (!/^\d{4}$/.test(pin)) return alert("Код-пароль: 4 цифры");
    
    try {
      const tok = await kbApi.getLinkToken(token);
      if (!tok.used) {
        alert("Сначала привяжите Telegram через бота");
        return;
      }
      
      const u = await kbApi.createUser({
        id: userId,
        nickname: nickname.trim(),
        avatarUrl: skinUrlByNick(nickname.trim()),
        citizenship,
        bankAccount: bank.trim(),
        pin,
        tgId: tok.tg_id,
        tgUsername: tok.tg_username,
      });
      
      localStorage.removeItem("kbpost_pending_reg");
      localStorage.setItem("kbpost_user_id", u.id);
      onRegistered(u);
    } catch (e: any) {
      alert(e.message || "Ошибка регистрации");
    }
  };

  return (
    <Container>
      <div className="py-6 sm:py-10">
        <Card className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[22px] font-semibold tracking-tight">Регистрация в KBPOST</div>
              <div className="mt-1 text-[14px] text-[#6b7280]">Доступ только через Telegram Mini App</div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Chip active>Шаг {step} из 3</Chip>
            </div>
          </div>
          <Divider />
          {step === 1 && (
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] items-end">
              <Input
                label="Никнейм в Minecraft"
                placeholder="Например: Steve123"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <Button onClick={() => setStep(2)} disabled={!nickname.trim()} className="sm:w-[180px]">
                Далее
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="mt-5">
              <div className="text-[15px]">Сгенерируйте токен для привязки Telegram</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={genToken} disabled={!!token}>Получить токен</Button>
                <Button variant="ghost" onClick={() => setStep(1)}>Назад</Button>
              </div>
              {token && (
                <div className="mt-5 rounded-[14px] border border-[#e9eaee] bg-[#fbfcfe] p-4">
                  <div className="text-[13px] text-[#6b7280]">Скопируйте команду и отправьте боту:</div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="rounded-[10px] bg-black px-3 py-2 text-[15px] font-medium text-white">/link {token}</code>
                    <Button variant="soft" onClick={() => copy(`/link ${token}`)}>Копировать</Button>
                  </div>
                  <div className="mt-2 text-[12px] text-[#7a7f87]">
                    Токен действителен 5 минут. {checking ? "Ожидание привязки..." : "После копирования Mini App закроется автоматически."}
                  </div>
                </div>
              )}
              <div className="mt-6 rounded-[14px] border border-dashed border-[#e1e3e8] p-4 text-[13px] text-[#6b7280]">
                После отправки команды боту вы получите сообщение с кнопкой «Продолжить регистрацию».
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-[13px] text-[#5f6368]">Гражданство</div>
                  <div className="flex gap-2">
                    {(["Столица", "Антегрия"] as Citizenship[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCitizenship(c)}
                        className={cn(
                          "h-11 rounded-[12px] px-4 border text-[15px]",
                          citizenship === c ? "bg-black text-white border-black" : "bg-white border-[#e1e3e8] hover:bg-[#f7f8fa]"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  label="Банковский счёт"
                  placeholder="KB-XXXX-XXXX"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                />
              </div>
              <Input
                label="Код-пароль (4 цифры)"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <div className="flex gap-2">
                <Button onClick={finish} disabled={pin.length !== 4}>Завершить регистрацию</Button>
                <Button variant="ghost" onClick={() => setStep(2)}>Назад</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Container>
  );
}

/* ---------- PIN Gate ---------- */
function PinGate({ user, onUnlock }: { user: User; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (pin === user.pin) {
      localStorage.setItem("kbpost_pin_ok_" + user.id, String(Date.now()));
      onUnlock();
      tmaHaptic("medium");
    } else {
      setError("Неверный код");
      tmaHaptic("heavy");
      setPin("");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f7f8fa] grid place-items-center px-4">
      <Card className="w-full max-w-[380px] p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-[14px] grid place-items-center mb-3" style={{ background: Y.yellow }}>
            <span className="text-[22px] font-black">KB</span>
          </div>
          <div className="text-[20px] font-semibold">Введите код-пароль</div>
          <div className="mt-1 text-[13px] text-[#6b7280]">Для {user.nickname}</div>
        </div>
        <div className="mt-5">
          <input
            autoFocus
            inputMode="numeric"
            pattern="\d*"
            maxLength={4}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && submit()}
            className="h-14 w-full rounded-[14px] border border-[#e1e3e8] bg-white text-center text-[28px] tracking-[0.5em] outline-none focus:border-[#1a73e8] focus:ring-4 focus:ring-[#1a73e81a]"
            placeholder="••••"
          />
          {error && <div className="mt-2 text-center text-[13px] text-[#ff3b30]">{error}</div>}
          <Button className="mt-4 w-full" onClick={submit} disabled={pin.length !== 4}>Войти</Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Parcels ---------- */
function ParcelsPage({ me, parcels, onRefresh }: { me: User; parcels: Parcel[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState<"all" | "sent" | "received">("all");
  
  const filtered = useMemo(() => {
    if (filter === "sent") return parcels.filter(p => p.senderId === me.id);
    if (filter === "received") return parcels.filter(p => p.recipientId === me.id);
    return parcels;
  }, [parcels, filter, me.id]);

  const payParcel = async (id: string) => {
    try {
      await kbApi.payParcel(id);
      onRefresh();
      tmaHaptic("medium");
    } catch (e) {
      alert("Ошибка оплаты");
    }
  };

  return (
    <Container>
      <div className="py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[18px] font-semibold">Мои посылки</h2>
          <div className="flex gap-1.5">
            {(["all", "sent", "received"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-8 rounded-full px-3 text-[13px] border",
                  filter === f ? "bg-black text-white border-black" : "bg-white border-[#e5e7eb]"
                )}
              >
                {f === "all" ? "Все" : f === "sent" ? "Отправленные" : "Полученные"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-[15px] text-[#6b7280]">Посылок пока нет</div>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map(p => {
              const isRecipient = p.recipientId === me.id;
              const canPay = isRecipient && p.codEnabled && !p.codPaid && p.status === "Ожидает оплату";
              
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{p.description}</div>
                        <span className={cn(
                          "text-[11px] px-2 py-0.5 rounded-full border",
                          p.status === "Выдана" ? "bg-[#e8f5ec] text-[#0a7a2f] border-[#c8e6d1]" :
                          p.status === "В пути" ? "bg-[#e8f0fe] text-[#174ea6] border-[#c6dafc]" :
                          p.status === "Ожидает оплату" ? "bg-[#fff4e5] text-[#b05d00] border-[#ffe0b2]" :
                          "bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]"
                        )}>{p.status}</span>
                      </div>
                      <div className="mt-1.5 text-[13px] text-[#6b7280] flex flex-wrap gap-x-3 gap-y-1">
                        <span>От: <b className="text-[#111]">{p.senderNickname || "—"}</b></span>
                        <span>Кому: <b className="text-[#111]">{p.recipientNickname || "—"}</b></span>
                      </div>
                      <div className="mt-1 text-[12px] text-[#9aa0a6]">
                        {p.fromBranchName} → {p.toBranchName}
                      </div>
                      {p.codEnabled && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-[12px]">
                          <span className="px-2 py-0.5 rounded-full bg-[#fff7d6] border border-[#ffe08a] text-[#7a5d00]">
                            Наложка: {p.codAmount}Ⓒ {p.codPaid ? "✓ оплачено" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {canPay && (
                      <Button onClick={() => payParcel(p.id)} className="shrink-0">Оплатить</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Container>
  );
}

/* ---------- Create Parcel ---------- */
function CreatePage({ me, branches, onCreated }: { me: User; branches: Branch[]; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState("");
  const [recipientNick, setRecipientNick] = useState("");
  const [recipient, setRecipient] = useState<User | null>(null);
  const [fromBranch, setFromBranch] = useState<string>("");
  const [toBranch, setToBranch] = useState<string>("");
  const [cod, setCod] = useState(false);
  const [codAmount, setCodAmount] = useState("");
  const [checking, setChecking] = useState(false);

  const checkRecipient = async () => {
    if (!recipientNick.trim()) return;
    setChecking(true);
    try {
      const user = await kbApi.getUserByNick(recipientNick.trim());
      setRecipient(user);
    } catch {
      setRecipient(null);
      alert("Пользователь не найден");
    }
    setChecking(false);
  };

  const canCreate = description.trim() && recipient && fromBranch && toBranch && fromBranch !== toBranch && (!cod || Number(codAmount) > 0);

  const create = async () => {
    if (!canCreate || !recipient) return;
    try {
      await kbApi.createParcel({
        id: uuid(),
        description: description.trim(),
        senderId: me.id,
        recipientId: recipient.id,
        fromBranchId: fromBranch,
        toBranchId: toBranch,
        codEnabled: cod,
        codAmount: cod ? Number(codAmount) : undefined,
      });
      setDescription(""); setRecipientNick(""); setRecipient(null);
      setFromBranch(""); setToBranch(""); setCod(false); setCodAmount("");
      setStep(1);
      onCreated();
      tmaHaptic("medium");
    } catch (e) {
      alert("Ошибка создания");
    }
  };

  return (
    <Container>
      <div className="py-5">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold">Новая посылка</h2>
            <Chip active>Шаг {step} из 3</Chip>
          </div>
          <Divider />

          {step === 1 && (
            <div className="mt-4 grid gap-4">
              <Input label="Описание" placeholder="Например: Алмазная кирка" value={description} onChange={e => setDescription(e.target.value)} />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input label="Ник получателя" placeholder="Steve123" value={recipientNick} onChange={e => { setRecipientNick(e.target.value); setRecipient(null); }} />
                <Button className="sm:self-end" onClick={checkRecipient} disabled={!recipientNick.trim() || checking}>
                  {checking ? "..." : "Проверить"}
                </Button>
              </div>
              {recipient && (
                <div className="rounded-[12px] border border-[#e9eaee] bg-[#f9fafb] p-3 flex items-center gap-2">
                  <img src={recipient.avatarUrl || skinUrlByNick(recipient.nickname)} className="h-8 w-8 rounded-full" alt="" />
                  <div className="text-[14px]">Получатель: <b>{recipient.nickname}</b> • {recipient.citizenship}</div>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!description.trim() || !recipient}>Далее</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 grid gap-4">
              <div>
                <div className="mb-1.5 text-[13px] text-[#5f6368]">Отделение отправки</div>
                <select className="h-11 w-full rounded-[12px] border border-[#e1e3e8] px-3" value={fromBranch} onChange={e => setFromBranch(e.target.value)}>
                  <option value="">Выберите</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-[13px] text-[#5f6368]">Отделение доставки</div>
                <select className="h-11 w-full rounded-[12px] border border-[#e1e3e8] px-3" value={toBranch} onChange={e => setToBranch(e.target.value)}>
                  <option value="">Выберите</option>
                  {branches.filter(b => b.id !== fromBranch).map(b => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
                </select>
              </div>
              <div className="rounded-[12px] border border-[#e9eaee] p-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-[14px] font-medium">Наложенный платеж</div>
                    <div className="text-[12px] text-[#6b7280]">Получатель оплатит при получении</div>
                  </div>
                  <input type="checkbox" checked={cod} onChange={e => setCod(e.target.checked)} className="h-5 w-5 accent-black" />
                </label>
                {cod && (
                  <div className="mt-3">
                    <Input label="Сумма" type="number" placeholder="100" value={codAmount} onChange={e => setCodAmount(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Назад</Button>
                <Button onClick={() => setStep(3)} disabled={!fromBranch || !toBranch || fromBranch === toBranch}>Далее</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-4">
              <div className="rounded-[14px] border border-[#e9eaee] bg-[#fbfcfe] p-4 grid gap-2 text-[14px]">
                <div><span className="text-[#6b7280]">Описание:</span> <b>{description}</b></div>
                <div><span className="text-[#6b7280]">Получатель:</span> <b>{recipient?.nickname}</b></div>
                <div><span className="text-[#6b7280]">Маршрут:</span> <b>{branches.find(b => b.id === fromBranch)?.name} → {branches.find(b => b.id === toBranch)?.name}</b></div>
                <div><span className="text-[#6b7280]">Наложка:</span> <b>{cod ? `${codAmount}Ⓒ` : "нет"}</b></div>
              </div>
              <div className="mt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Заново</Button>
                <Button onClick={create} disabled={!canCreate}>Создать</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Container>
  );
}

/* ---------- Settings ---------- */
function SettingsPage({ me, onUpdate, onLogout }: { me: User; onUpdate: (u: User) => void; onLogout: () => void }) {
  const [bank, setBank] = useState(me.bankAccount || "");
  const [editing, setEditing] = useState(false);

  const saveBank = async () => {
    try {
      const updated = await kbApi.updateUser(me.id, { bankAccount: bank.trim() });
      onUpdate(updated);
      setEditing(false);
      tmaHaptic("light");
    } catch {
      alert("Ошибка сохранения");
    }
  };

  const resetPin = async () => {
    if (!confirm("Сбросить код-пароль? В боте придет запрос на новый код.")) return;
    try {
      await kbApi.requestPinReset(me.id);
      tmaClose();
    } catch {
      alert("Ошибка");
    }
  };

  return (
    <Container>
      <div className="py-5 grid gap-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <img src={me.avatarUrl || skinUrlByNick(me.nickname)} className="h-12 w-12 rounded-full border" alt="" />
            <div>
              <div className="text-[18px] font-semibold">{me.nickname}</div>
              <div className="text-[13px] text-[#6b7280]">
                Telegram: {me.tgUsername ? "@" + me.tgUsername : me.tgId ? `ID ${me.tgId}` : "—"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[16px] font-semibold">Профиль</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[12px] border border-[#e9eaee] p-3">
              <div className="text-[12px] text-[#6b7280]">Гражданство</div>
              <div className="text-[15px] font-medium">{me.citizenship || "—"}</div>
            </div>
            <div className="rounded-[12px] border border-[#e9eaee] p-3">
              <div className="text-[12px] text-[#6b7280]">Банковский счёт</div>
              {!editing ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[15px] font-medium">{me.bankAccount || "—"}</div>
                  <Button variant="soft" onClick={() => setEditing(true)}>Изменить</Button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Input value={bank} onChange={e => setBank(e.target.value)} placeholder="KB-XXXX-XXXX" />
                  <Button onClick={saveBank}>Сохранить</Button>
                  <Button variant="ghost" onClick={() => { setEditing(false); setBank(me.bankAccount || ""); }}>Отмена</Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[16px] font-semibold">Безопасность</div>
              <div className="text-[13px] text-[#6b7280]">Сброс код-пароля через бота</div>
            </div>
            <Button variant="danger" onClick={resetPin}>Сбросить код-пароль</Button>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onLogout}>Выйти</Button>
        </div>
      </div>
    </Container>
  );
}

/* ---------- Admin ---------- */
function AdminPanel({ users, parcels, branches, onRefresh }: any) {
  const [tab, setTab] = useState<"users" | "parcels" | "branches">("users");

  const toggleAdmin = async (u: User) => {
    try {
      await kbApi.updateUser(u.id, { isAdmin: !u.isAdmin });
      onRefresh();
    } catch {}
  };

  const updateParcelStatus = async (id: string, status: ParcelStatus) => {
    try {
      await kbApi.updateParcel(id, { status });
      onRefresh();
    } catch {}
  };

  return (
    <div className="border-t border-[#eceef2] bg-white">
      <Container>
        <div className="py-5">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">Админ-панель</h2>
              <div className="flex gap-2">
                {(["users", "parcels", "branches"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} className={cn("h-9 rounded-full px-3 text-[13px] border", tab === t ? "bg-black text-white border-black" : "bg-white border-[#e5e7eb]")}>
                    {t === "users" ? "Пользователи" : t === "parcels" ? "Посылки" : "Отделения"}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {tab === "users" && (
            <div className="mt-3 grid gap-2">
              {users.map((u: User) => (
                <Card key={u.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={u.avatarUrl || skinUrlByNick(u.nickname)} className="h-8 w-8 rounded-full" alt="" />
                      <div>
                        <div className="text-[14px] font-medium">{u.nickname}</div>
                        <div className="text-[11px] text-[#6b7280]">{u.tgUsername ? "@" + u.tgUsername : "—"} • {u.citizenship}</div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                      <input type="checkbox" checked={!!u.isAdmin} onChange={() => toggleAdmin(u)} className="h-4 w-4 accent-black" />
                      Админ
                    </label>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === "parcels" && (
            <div className="mt-3 grid gap-2">
              {parcels.map((p: Parcel) => (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px]">{p.description}</div>
                      <div className="text-[11px] text-[#6b7280]">{p.senderNickname} → {p.recipientNickname}</div>
                    </div>
                    <select value={p.status} onChange={e => updateParcelStatus(p.id, e.target.value as ParcelStatus)} className="h-8 rounded border px-2 text-[12px]">
                      {(["Создана", "В пути", "В отделении", "Ожидает оплату", "Выдана", "Отклонена"] as ParcelStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === "branches" && (
            <div className="mt-3">
              <Card className="p-3">
                <div className="text-[13px] text-[#6b7280]">Управление отделениями через API (создание/удаление доступно в коде сервера)</div>
              </Card>
              <div className="mt-2 grid gap-2">
                {branches.map((b: Branch) => (
                  <Card key={b.id} className="p-3">
                    <div className="text-[14px] font-medium">{b.name}</div>
                    <div className="text-[12px] text-[#6b7280]">{b.city}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

/* ---------- Main App ---------- */
export default function App() {
  const data = useAppData();
  const [tab, setTab] = useState<TabKey>("parcels");
  const [pinOk, setPinOk] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    tmaReady();
    init();
  }, []);

  const init = async () => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser) {
        await kbApi.trackTg(String(tgUser.id), tgUser.username);
        
        try {
          const user = await kbApi.getUserByTg(String(tgUser.id));
          data.setUser(user);
          localStorage.setItem("kbpost_user_id", user.id);
          
          const pinOkTime = localStorage.getItem("kbpost_pin_ok_" + user.id);
          if (pinOkTime && Date.now() - Number(pinOkTime) < 10 * 60 * 1000) {
            setPinOk(true);
          }
          
          await Promise.all([
            data.refreshParcels(user.id),
            data.refreshBranches(),
            user.isAdmin ? data.refreshUsers() : Promise.resolve(),
          ]);
        } catch {
          // user not found - need registration
        }
      }
    } catch (e) {
      console.error("Init error", e);
    } finally {
      data.setLoading(false);
    }
  };

  const handleRegistered = async (u: User) => {
    data.setUser(u);
    setPinOk(false);
    await Promise.all([
      data.refreshParcels(u.id),
      data.refreshBranches(),
    ]);
  };

  const handleLogout = () => {
    localStorage.removeItem("kbpost_user_id");
    if (data.user) localStorage.removeItem("kbpost_pin_ok_" + data.user.id);
    data.setUser(null);
    setPinOk(false);
  };

  const refreshAll = async () => {
    if (!data.user) return;
    await Promise.all([
      data.refreshParcels(data.user.id),
      data.refreshBranches(),
      data.user.isAdmin ? data.refreshUsers() : Promise.resolve(),
    ]);
  };

  if (data.loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f7f8fa] grid place-items-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-[14px] mx-auto mb-3 grid place-items-center" style={{ background: Y.yellow }}>
            <span className="text-[22px] font-black">KB</span>
          </div>
          <div className="text-[14px] text-[#6b7280]">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!data.user) {
    return (
      <div className="min-h-[100dvh] bg-[#f7f8fa] text-[#111]">
        <YandexHeader />
        <RegistrationFlow onRegistered={handleRegistered} />
      </div>
    );
  }

  if (!pinOk && data.user.pin) {
    return <PinGate user={data.user} onUnlock={() => setPinOk(true)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-[#f7f8fa] text-[#111]">
      <YandexHeader nickname={data.user.nickname} avatar={data.user.avatarUrl} />
      <Tabs tab={tab} setTab={setTab} />

      {tab === "parcels" && <ParcelsPage me={data.user} parcels={data.parcels} onRefresh={() => data.refreshParcels(data.user!.id)} />}
      {tab === "create" && <CreatePage me={data.user} branches={data.branches} onCreated={() => data.refreshParcels(data.user!.id)} />}
      {tab === "settings" && <SettingsPage me={data.user} onUpdate={data.setUser} onLogout={handleLogout} />}

      {data.user.isAdmin && <AdminPanel users={data.users} parcels={data.parcels} branches={data.branches} onRefresh={refreshAll} />}

      <div className="h-10" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        html, body, #root { height: 100%; }
        body { font-family: "Manrope", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
      `}</style>
    </div>
  );
}