import { LedgerHeader } from '@/components/ledger/LedgerHeader';

export { TShirtsPage } from './TShirtsPage';
export { EntrainementsPage } from './EntrainementsPage';
export { PendingPage } from './PendingPage';

export function SettingsPage() {
  return (
    <div className="flex h-full flex-col bg-paper">
      <LedgerHeader title="Réglages" />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-serif text-[20px] text-ink">À venir</p>
        <p className="text-[12px] text-ink-55">Gestion du compte, préférences, export des données.</p>
      </div>
    </div>
  );
}
