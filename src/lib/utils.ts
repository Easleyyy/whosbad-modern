import { clsx, type ClassValue } from 'clsx';
import { format, parse, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PaymentStatus, Sale } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
    if (!isValid(parsed)) return dateStr;
    return format(parsed, 'd MMM yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'Oui': return 'text-success-600 bg-success-100';
    case 'Non': return 'text-danger-600 bg-danger-100';
    case '-':   return 'text-gray-500 bg-gray-100 dark:bg-surface-800 dark:text-gray-400';
  }
}

export function getStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'Oui': return 'Payé';
    case 'Non': return 'En attente';
    case '-':   return 'Soldé';
  }
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-primary-600', 'bg-teal-600', 'bg-warning-600',
    'bg-danger-600', 'bg-purple-600', 'bg-pink-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function filterSales(sales: Sale[], search: string, status: string): Sale[] {
  return sales.filter((s) => {
    if (status === 'paid' && s.paye !== 'Oui') return false;
    if (status === 'pending' && s.paye !== 'Non') return false;
    if (status === 'dash' && s.paye !== '-') return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.acheteur.toLowerCase().includes(q) ||
        s.vendeur.toLowerCase().includes(q) ||
        (s.commentaire ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });
}
