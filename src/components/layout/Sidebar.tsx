import { NavLink } from 'react-router-dom';
import { useAllSalesData } from '@/hooks/useSales';

const NAV = [
  { to: '/', label: 'Volants' },
  { to: '/tshirts', label: 'T-Shirts' },
  { to: '/entrainements', label: 'Entraînements' },
  { to: '/pending', label: 'Impayés' },
  { to: '/settings', label: 'Réglages' },
] as const;

/** Desktop-only left rail nav — replaces BottomTabs at the lg breakpoint. */
export function Sidebar() {
  const { data: allSales = [] } = useAllSalesData();
  const pendingCount = allSales.filter((s) => s.paye === 'Non').length;

  return (
    <aside className="hidden w-[220px] flex-none flex-col border-r-2 border-ink px-6 pb-8 pt-7 lg:flex">
      <div className="mb-10">
        <h1 className="font-serif text-[22px] leading-none text-ink">Who&apos;s Bad</h1>
        <p className="mt-1 font-mono text-[9px] font-medium tracking-label text-ink-45">LOGISTIQUE</p>
      </div>

      <nav className="flex flex-col gap-4">
        {NAV.map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className="text-[13px]">
            {({ isActive }) => (
              <div className="flex items-baseline justify-between gap-2">
                <span className={isActive ? 'border-b-2 border-ink pb-0.5 font-semibold text-ink' : 'text-ink-45 hover:text-ink'}>
                  {label}
                </span>
                {label === 'Impayés' && pendingCount > 0 && (
                  <span className="font-mono text-[10px] font-semibold text-alert">{pendingCount}</span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
