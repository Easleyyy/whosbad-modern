import { NavLink } from 'react-router-dom';
import { useAllSalesData } from '@/hooks/useSales';

const TABS = [
  { to: '/', label: 'Volants' },
  { to: '/tshirts', label: 'T-Shirts' },
  { to: '/entrainements', label: 'Entraîn.' },
  { to: '/pending', label: 'Impayés' },
] as const;

export function BottomTabs() {
  const { data: allSales = [] } = useAllSalesData();
  const pendingCount = allSales.filter((s) => s.paye === 'Non').length;

  return (
    <nav
      className="flex flex-none gap-3.5 border-t border-ink-hairline bg-paper px-[22px] pt-3 pb-safe"
    >
      {TABS.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === '/'} className="flex items-center gap-1 text-[11px]">
          {({ isActive }) => (
            <>
              {isActive ? (
                <span className="border-b-2 border-ink pb-0.5 font-semibold text-ink">{label}</span>
              ) : (
                <span className="font-normal text-ink-45">{label}</span>
              )}
              {label === 'Impayés' && pendingCount > 0 && (
                <span className="font-mono text-[10px] font-semibold text-alert">{pendingCount}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
