export interface User {
  id: string;
  username: string;
  telegramUsername: string;
  password: string;
  citizenship: string;
  account: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface StatusEntry {
  status: number;
  label: string;
  timestamp: string;
}

export interface Parcel {
  id: string;
  ttn: string;
  description: string;
  senderId: string;
  receiverId: string;
  senderUsername: string;
  receiverUsername: string;
  status: number;
  statusHistory: StatusEntry[];
  fromBranchId: string;
  toBranchId: string | null;
  toCoordinates: string | null;
  cashOnDelivery: boolean;
  cashOnDeliveryAmount: number;
  cashOnDeliveryPaid: boolean;
  cashOnDeliveryConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  number: number;
  region: string;
  prefecture: string;
  address: string;
}

export const STATUS_LABELS: Record<number, string> = {
  1: 'Посылка оформлена',
  2: 'Приняли в отделении',
  3: 'Выехала из отделения',
  4: 'Прибыла в терминал',
  5: 'Выехала из терминала',
  6: 'Прибыла в отделение',
  7: 'Получено в отделении',
  8: 'Доставлена на координаты',
};

export const STATUS_COLORS: Record<number, string> = {
  1: '#f59e0b',
  2: '#3b82f6',
  3: '#8b5cf6',
  4: '#6366f1',
  5: '#a855f7',
  6: '#10b981',
  7: '#22c55e',
  8: '#22c55e',
};

export const ADMIN_STATUSES = [3, 4, 5, 6, 8];

export function getBranchDisplay(branch: Branch): { line1: string; line2: string } {
  const prefLabel = branch.region === 'Столица' ? branch.prefecture : branch.prefecture;
  return {
    line1: `Отделение ${branch.number} | ${branch.region}`,
    line2: `${prefLabel}, ${branch.address}`,
  };
}
