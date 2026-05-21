export type PaymentMode =
  | 'Virement' | 'Espèces' | 'Chèque' | 'CB'
  | 'Square' | 'Assoconnect' | 'PayPal'
  | 'Wero' | 'Site internet' | 'Autre';

export type PaymentStatus = 'Oui' | 'Non' | '-';

export type ProductTab = 'Victor GM' | 'Victor PC' | 'CBX RED' | 'CBX BLUE';

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
  produit?: ProductTab;
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
  action: 'vente' | 'modifier' | 'conversation' | 'square_payment';
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
}

export interface TrainingGroup {
  [groupe: string]: TrainingPlayer[];
}
