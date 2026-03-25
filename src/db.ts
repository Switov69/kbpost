import { User, Parcel, Branch, STATUS_LABELS } from './types';

const USERS_KEY = 'kbpost_users';
const PARCELS_KEY = 'kbpost_parcels';
const BRANCHES_KEY = 'kbpost_branches';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function generateTTN(): string {
  const parcels = getParcels();
  const existingTTNs = new Set(parcels.map(p => p.ttn));
  let ttn: string;
  do {
    const num = Math.floor(1 + Math.random() * 9999);
    ttn = `#${num.toString().padStart(4, '0')}`;
  } while (existingTTNs.has(ttn));
  return ttn;
}

const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'br_stolica_1',
    number: 1,
    region: 'Столица',
    prefecture: 'Holeland',
    address: 'аскб авеню, 6',
  },
  {
    id: 'br_antegriya_1',
    number: 1,
    region: 'Антегрия',
    prefecture: 'Данюшатаун',
    address: '',
  },
];

export function initDB(): void {
  if (!localStorage.getItem(USERS_KEY)) {
    const adminUser: User = {
      id: 'admin_001',
      username: 'Markizow',
      telegramUsername: '@markizow',
      password: 'Ilya8961a',
      citizenship: 'Столица',
      account: 'Свит',
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([adminUser]));
  } else {
    const users = getUsers();
    const admin = users.find(u => u.username === 'Markizow');
    if (!admin) {
      users.push({
        id: 'admin_001',
        username: 'Markizow',
        telegramUsername: '@markizow',
        password: 'Ilya8961a',
        citizenship: 'Столица',
        account: 'Свит',
        isAdmin: true,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }
  if (!localStorage.getItem(PARCELS_KEY)) {
    localStorage.setItem(PARCELS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(BRANCHES_KEY)) {
    localStorage.setItem(BRANCHES_KEY, JSON.stringify(DEFAULT_BRANCHES));
  }
}

// ===== BRANCHES =====

export function getBranches(): Branch[] {
  const data = localStorage.getItem(BRANCHES_KEY);
  return data ? JSON.parse(data) : DEFAULT_BRANCHES;
}

export function getBranchById(id: string): Branch | undefined {
  return getBranches().find(b => b.id === id);
}

export function createBranch(data: Omit<Branch, 'id'>): Branch {
  const branches = getBranches();
  const newBranch: Branch = { ...data, id: generateId() };
  branches.push(newBranch);
  localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
  return newBranch;
}

export function updateBranch(id: string, data: Partial<Branch>): Branch | undefined {
  const branches = getBranches();
  const index = branches.findIndex(b => b.id === id);
  if (index === -1) return undefined;
  branches[index] = { ...branches[index], ...data };
  localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
  return branches[index];
}

export function deleteBranch(id: string): boolean {
  const branches = getBranches();
  const filtered = branches.filter(b => b.id !== id);
  if (filtered.length === branches.length) return false;
  localStorage.setItem(BRANCHES_KEY, JSON.stringify(filtered));
  return true;
}

// ===== USERS =====

export function getUsers(): User[] {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function getUserByUsername(username: string): User | undefined {
  return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function getUserByTelegram(tg: string): User | undefined {
  return getUsers().find(u => u.telegramUsername.toLowerCase() === tg.toLowerCase());
}

export function createUser(userData: Omit<User, 'id' | 'createdAt' | 'isAdmin'>): User {
  const users = getUsers();
  const newUser: User = {
    ...userData,
    id: generateId(),
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return newUser;
}

export function updateUser(id: string, data: Partial<User>): User | undefined {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return undefined;
  users[index] = { ...users[index], ...data };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users[index];
}

export function makeAdmin(userId: string): User | undefined {
  return updateUser(userId, { isAdmin: true });
}

export function removeAdmin(userId: string): User | undefined {
  return updateUser(userId, { isAdmin: false });
}

export function deleteUser(userId: string): boolean {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== userId);
  if (filtered.length === users.length) return false;
  localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
  return true;
}

// ===== PARCELS =====

export function getParcels(): Parcel[] {
  const data = localStorage.getItem(PARCELS_KEY);
  return data ? JSON.parse(data) : [];
}

export function getParcelById(id: string): Parcel | undefined {
  return getParcels().find(p => p.id === id);
}

export function getParcelByTTN(ttn: string): Parcel | undefined {
  return getParcels().find(p => p.ttn.toLowerCase() === ttn.toLowerCase());
}

export function getUserParcels(userId: string): Parcel[] {
  return getParcels().filter(p => p.senderId === userId || p.receiverId === userId);
}

export function createParcel(parcelData: {
  description: string;
  senderId: string;
  receiverId: string;
  senderUsername: string;
  receiverUsername: string;
  fromBranchId: string;
  toBranchId: string | null;
  toCoordinates: string | null;
  cashOnDelivery: boolean;
  cashOnDeliveryAmount: number;
}): Parcel {
  const parcels = getParcels();
  const now = new Date().toISOString();
  const newParcel: Parcel = {
    ...parcelData,
    id: generateId(),
    ttn: generateTTN(),
    status: 1,
    statusHistory: [{ status: 1, label: STATUS_LABELS[1], timestamp: now }],
    cashOnDeliveryPaid: false,
    cashOnDeliveryConfirmed: false,
    createdAt: now,
    updatedAt: now,
  };
  parcels.push(newParcel);
  localStorage.setItem(PARCELS_KEY, JSON.stringify(parcels));
  return newParcel;
}

export function updateParcel(id: string, data: Partial<Parcel>): Parcel | undefined {
  const parcels = getParcels();
  const index = parcels.findIndex(p => p.id === id);
  if (index === -1) return undefined;
  parcels[index] = { ...parcels[index], ...data, updatedAt: new Date().toISOString() };
  localStorage.setItem(PARCELS_KEY, JSON.stringify(parcels));
  return parcels[index];
}

export function updateParcelStatus(id: string, newStatus: number): Parcel | undefined {
  const parcel = getParcelById(id);
  if (!parcel) return undefined;
  const now = new Date().toISOString();
  const updatedHistory = [
    ...parcel.statusHistory,
    { status: newStatus, label: STATUS_LABELS[newStatus], timestamp: now },
  ];
  return updateParcel(id, { status: newStatus, statusHistory: updatedHistory });
}

export function deleteParcel(id: string): boolean {
  const parcels = getParcels();
  const filtered = parcels.filter(p => p.id !== id);
  if (filtered.length === parcels.length) return false;
  localStorage.setItem(PARCELS_KEY, JSON.stringify(filtered));
  return true;
}

export function markParcelPaid(id: string): Parcel | undefined {
  return updateParcel(id, { cashOnDeliveryPaid: true });
}

export function confirmParcelPayment(id: string): Parcel | undefined {
  return updateParcel(id, { cashOnDeliveryConfirmed: true });
}

// ===== STATS =====

export function getUserStats(userId: string): { sent: number; received: number; active: number } {
  const parcels = getUserParcels(userId);
  const sent = parcels.filter(p => p.senderId === userId).length;
  const received = parcels.filter(p => p.receiverId === userId).length;
  const active = parcels.filter(p => p.status < 7).length;
  return { sent, received, active };
}
