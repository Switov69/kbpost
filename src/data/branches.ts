import type { Branch } from '../types';

export const BRANCHES: Branch[] = [
  { id: 'cap-1', name: 'Отделение №1', city: 'capital', address: 'ул. Центральная, 1' },
  { id: 'cap-2', name: 'Отделение №2', city: 'capital', address: 'пр. Главный, 14' },
  { id: 'cap-3', name: 'Отделение №3', city: 'capital', address: 'ул. Северная, 7' },
  { id: 'cap-4', name: 'Отделение №4', city: 'capital', address: 'пл. Свободы, 3' },
  { id: 'ant-1', name: 'Отделение №1', city: 'antegiya', address: 'ул. Морская, 5' },
  { id: 'ant-2', name: 'Отделение №2', city: 'antegiya', address: 'пр. Восточный, 22' },
  { id: 'ant-3', name: 'Отделение №3', city: 'antegiya', address: 'ул. Портовая, 9' },
];

export const CITIZENSHIP_LABELS: Record<string, string> = {
  capital: '🏛️ Столица',
  antegiya: '⚓ Антегия',
};

export function getBranchLabel(branchId: string): string {
  const b = BRANCHES.find(b => b.id === branchId);
  if (!b) return branchId;
  return `${CITIZENSHIP_LABELS[b.city]} · ${b.name}`;
}
