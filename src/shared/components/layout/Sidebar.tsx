import { NavLink } from 'react-router-dom';
import {
  Users,
  UserPlus,
  CreditCard,
  Stethoscope,
  HeartHandshake,
} from 'lucide-react';

const navItems = [
  { to: '/buyer', label: 'BUYER', icon: Users },
  { to: '/lead', label: 'LEAD', icon: UserPlus },
  { to: '/payer', label: 'PAYER', icon: CreditCard },
  { to: '/customer', label: 'CUSTOMER', icon: Stethoscope },
  { to: '/turned', label: 'TURNED', icon: HeartHandshake },
];

export function Sidebar({ onClickItem }: { onClickItem?: () => void }) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onClickItem}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
              isActive
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
