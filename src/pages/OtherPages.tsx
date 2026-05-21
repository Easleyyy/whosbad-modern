export { TShirtsPage } from './TShirtsPage';
export { EntrainementsPage } from './EntrainementsPage';

export function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 px-8 text-center">
      <p className="text-lg font-semibold text-white">Réglages</p>
      <p className="text-sm">À venir — gestion du compte, préférences, export des données.</p>
    </div>
  );
}
