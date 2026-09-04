export type PaymentMode =
  | 'Virement' | 'Espèces' | 'Chèque' | 'CB'
  | 'Square' | 'Assoconnect' | 'PayPal'
  | 'Wero' | 'Site internet' | 'Autre';

export type PaymentStatus = 'Oui' | 'Non' | '-';

export type ProductTab = 'Victor GM' | 'Victor PC' | 'CBX RED' | 'CBX BLUE';

export interface ProductReference {
  id: string;
  name: string;
  price: number;
  color: string;
  isDefault?: boolean;
}

export const COLOR_OPTIONS = [
  { id: 'amber',  label: 'Ambre',  hex: '#f59e0b' },
  { id: 'teal',   label: 'Teal',   hex: '#2dd4bf' },
  { id: 'red',    label: 'Rouge',  hex: '#ef4444' },
  { id: 'blue',   label: 'Bleu',   hex: '#60a5fa' },
  { id: 'purple', label: 'Violet', hex: '#c084fc' },
  { id: 'orange', label: 'Orange', hex: '#fb923c' },
  { id: 'pink',   label: 'Rose',   hex: '#f472b6' },
  { id: 'green',  label: 'Vert',   hex: '#4ade80' },
  { id: 'cyan',   label: 'Cyan',   hex: '#22d3ee' },
  { id: 'white',  label: 'Blanc',  hex: '#e2e8f0' },
] as const;

export function getColorHex(colorId: string): string {
  return (COLOR_OPTIONS as readonly { id: string; hex: string }[])
    .find((c) => c.id === colorId)?.hex ?? '#9ca3af';
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface Sale {
  id: string;
  _row?: number;
  date: string;
  vendeur: string;
  acheteur: string;
  quantite: number;
  paye: PaymentStatus;
  mode_paiement: PaymentMode | '';
  commentaire?: string;
  produit?: string;
  montant?: number;
}

export interface SaleFilters {
  status?: 'all' | 'paid' | 'pending' | 'dash';
  search?: string;
  vendeur?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface Stats {
  totalStock: number;
  totalSold: number;
  totalPending: number;
  caMonth: number;
  pendingAmount: number;
}

export interface AIParseResult {
  action: 'vente' | 'modifier' | 'conversation' | 'square_payment' | 'stock_update';
  message: string;
  data?: Partial<Sale>[];
  triggerSmash?: boolean;
}

export interface TShirtItem {
  marque: string;
  sexe: string;
  taille: string;
  quantite: number;
}

export interface TrainingPlayer {
  nom: string;
  commentaire?: string;
  paiement?: 'pending' | 'paid' | 'unpaid';
}

export interface TrainingGroup {
  [groupe: string]: TrainingPlayer[];
}
