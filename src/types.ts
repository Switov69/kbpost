export type Citizenship = 'capital' | 'antegiya';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface UserProfile {
  id: number;
  telegram_id: number;
  nickname: string;
  citizenship: Citizenship;
  bank_account: string;
  notifications_enabled: boolean;
  created_at: string;
}

export interface Parcel {
  id: number;
  ttn: string;
  sender_id: number;
  receiver_id: number;
  sender_nickname: string;
  receiver_nickname: string;
  description: string;
  from_branch: string;
  to_branch: string;
  status: ParcelStatus;
  created_at: string;
  updated_at: string;
}

export type ParcelStatus = 'pending' | 'in_transit' | 'delivered' | 'cancelled';

export interface Branch {
  id: string;
  name: string;
  city: Citizenship;
  address: string;
}

export type AppPage = 'parcels' | 'create' | 'settings';

export interface AppState {
  page: AppPage;
  user: UserProfile | null;
  telegramUser: TelegramUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pinVerified: boolean;
}

export interface CreateParcelData {
  receiver_nickname: string;
  description: string;
  from_branch: string;
  to_branch: string;
}
