import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  BedDouble,
  AlertTriangle,
  FlaskConical,
  Pill,
  CheckSquare,
  MessageSquare,
  UserCircle,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
  Bell,
  MoreHorizontal,
  LogOut,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/doctor-portal/dashboard',    icon: LayoutDashboard, label: 'Tableau de bord' },
  { href: '/doctor-portal/agenda',       icon: Calendar,        label: 'Agenda' },
  { href: '/doctor-portal/patients-today', icon: Users,         label: 'Patients du jour' },
  { href: '/doctor-portal/my-patients',  icon: UserCheck,       label: 'Mes patients' },
  { href: '/doctor-portal/hospitalized', icon: BedDouble,       label: 'Hospitalisés' },
  { href: '/doctor-portal/emergencies',  icon: AlertTriangle,   label: 'Urgences' },
  { href: '/doctor-portal/results',      icon: FlaskConical,    label: 'Résultats' },
  { href: '/doctor-portal/prescriptions', icon: Pill,           label: 'Ordonnances' },
  { href: '/doctor-portal/tasks',        icon: CheckSquare,     label: 'Tâches' },
  { href: '/doctor-portal/messages',     icon: MessageSquare,   label: 'Messages' },
  { href: '/doctor-portal/profile',      icon: UserCircle,      label: 'Profil' },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/doctor-portal/dashboard',    icon: LayoutDashboard, label: 'Accueil' },
  { href: '/doctor-portal/agenda',       icon: Calendar,        label: 'Agenda' },
  { href: '/doctor-portal/patients-today', icon: Users,         label: 'Patients' },
  { href: '/doctor-portal/results',      icon: FlaskConical,    label: 'Résultats' },
];

interface Props {
  children: React.ReactNode;
}

export function DoctorPortalLayout({ children }: Props) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  const isActive = (href: string) => location === href || location.startsWith(href + '/');

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── DESKTOP SIDEBAR ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300',
          sidebarWidth,
          'bg-gradient-to-b from-[#0a2540] to-[#1a3a5c]',
        )}
      >
        {/* Logo / title */}
        <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-white/10', collapsed && 'justify-center px-0')}>
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <Stethoscope size={18} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-sm leading-tight">
              IRISSAM<br />
              <span className="font-normal text-white/70 text-xs">Médecin</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => setLocation(item.href)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5 rounded-lg text-sm transition-all duration-150 text-left',
                  collapsed ? 'justify-center mx-0 px-0 w-full rounded-none' : '',
                  active
                    ? 'bg-white/15 text-white border-l-2 border-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white border-l-2 border-transparent',
                )}
                style={{ maxWidth: collapsed ? '64px' : undefined }}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom: user info + logout */}
        <div className="border-t border-white/10 p-3 space-y-2">
          {!collapsed && (
            <>
              <div className="px-1">
                <p className="text-white text-sm font-medium truncate">
                  Dr. {user?.firstName} {user?.lastName}
                </p>
                <span className="inline-block text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full mt-0.5">
                  {user?.role ?? 'Médecin'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg px-2 py-2 text-sm transition-colors"
              >
                <LogOut size={16} />
                <span>Déconnexion</span>
              </button>
              <div className="border-t border-white/10 pt-2">
                <button
                  onClick={() => setLocation('/')}
                  className="w-full flex items-center gap-2 text-white/50 hover:text-white/80 text-xs px-2 py-1.5 rounded transition-colors"
                >
                  <ChevronLeft size={14} />
                  <span>ERP Admin</span>
                </button>
              </div>
            </>
          )}
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'flex items-center justify-center w-full py-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors',
            )}
            title={collapsed ? 'Développer' : 'Réduire'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE TOP BAR ──────────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gradient-to-r from-[#0a2540] to-[#1a3a5c] flex items-center px-4 gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-white/80 hover:text-white p-1"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
        <span className="flex-1 text-white font-semibold text-sm">IRISSAM Médecin</span>
        <button className="text-white/80 hover:text-white p-1" aria-label="Notifications">
          <Bell size={20} />
        </button>
      </header>

      {/* ─── MOBILE DRAWER ───────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-72 bg-gradient-to-b from-[#0a2540] to-[#1a3a5c] flex flex-col h-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Stethoscope size={20} className="text-white" />
                <span className="text-white font-bold text-sm">IRISSAM Médecin</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-white/60 hover:text-white"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 py-3 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => { setLocation(item.href); setDrawerOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-sm transition-all duration-150 text-left',
                      active
                        ? 'bg-white/15 text-white border-l-2 border-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white border-l-2 border-transparent',
                    )}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Bottom */}
            <div className="border-t border-white/10 p-4 space-y-3">
              <div>
                <p className="text-white text-sm font-medium">
                  Dr. {user?.firstName} {user?.lastName}
                </p>
                <span className="inline-block text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full mt-0.5">
                  {user?.role ?? 'Médecin'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-white/70 hover:text-white text-sm py-2"
              >
                <LogOut size={16} />
                <span>Déconnexion</span>
              </button>
              <div className="border-t border-white/10 pt-3">
                <button
                  onClick={() => { setLocation('/'); setDrawerOpen(false); }}
                  className="text-white/50 hover:text-white/80 text-xs flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  <span>ERP Admin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MOBILE BOTTOM NAV ───────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch h-16 safe-bottom">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => setLocation(item.href)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] leading-none">Plus</span>
        </button>
      </nav>

      {/* ─── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main
        className={cn(
          'transition-all duration-300',
          collapsed ? 'lg:ml-16' : 'lg:ml-64',
          'pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen',
        )}
      >
        {children}
      </main>
    </div>
  );
}
