'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { countActiveAlerts } from '@/services/alertService';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',   icon: '🏠' },
  { label: 'Pacientes',   href: '/pacientes',   icon: '👶' },
  { label: 'Consultas',   href: '/consultas',   icon: '📋' },
  { label: 'Crescimento', href: '/crescimento', icon: '📈' },
  { label: 'Vacinação',   href: '/vacinacao',   icon: '💉' },
  { label: 'Alertas',     href: '/alertas',     icon: '🔔' },
  // "Conhecimento" (base científica) ainda não está implementado — o item
  // volta à navegação quando o módulo for entregue (sprint futuro).
];

export function Sidebar() {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!userProfile) return;
    countActiveAlerts(userProfile.uid)
      .then(setAlertCount)
      .catch(() => {/* silencioso — badge é informativo */});
  }, [userProfile]);

  return (
    <aside
      className="flex h-full w-64 flex-col"
      style={{ background: 'var(--color-sidebar-bg)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] shadow">
          <span className="text-lg" aria-hidden="true">👶</span>
        </div>
        <span className="text-lg font-bold text-white tracking-tight">
          PueriCare
        </span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5" role="list">
          {navItems.map(({ label, href, icon }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                    transition-all duration-150
                    ${isActive
                      ? 'bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)] shadow-sm'
                      : 'text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover-bg)] hover:text-white'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="text-base" aria-hidden="true">{icon}</span>
                  <span className="flex-1">{label}</span>
                  {href === '/alertas' && alertCount > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white"
                      style={{ background: 'var(--color-danger, #ef4444)' }}
                      aria-label={`${alertCount} alertas ativos`}
                    >
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Rodapé da sidebar */}
      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <p className="px-3 text-xs" style={{ color: 'var(--color-sidebar-text)', opacity: 0.5 }}>
          v0.1.0 · MVP
        </p>
      </div>
    </aside>
  );
}
