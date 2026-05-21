import { NavLink } from 'react-router-dom';
import { CircleDot, Shirt, Calendar, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', icon: CircleDot, label: 'Volants' },
  { to: '/tshirts', icon: Shirt, label: 'T-Shirts' },
  { to: '/entrainements', icon: Calendar, label: 'Entraîn.' },
  { to: '/settings', icon: Settings, label: 'Réglages' },
] as const;

export function BottomNavigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface-900/95 backdrop-blur-xl border-t border-white/8 pb-safe">
      <div className="flex h-16">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors',
              isActive ? 'text-primary-500' : 'text-gray-500'
            )}
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(83,74,183,0.8)]')} aria-hidden />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
