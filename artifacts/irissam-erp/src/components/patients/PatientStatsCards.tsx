/**
 * PatientStatsCards — compteurs réels du patient (GET /patients/:id/stats).
 * Aucune donnée simulée : toutes les valeurs proviennent de PostgreSQL,
 * scoping strict par patient_id côté backend.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, Bed, ArrowRightFromLine, AlertCircle, FlaskConical, Scan,
  Pill, Receipt, CreditCard, CalendarClock, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types';
import { formatDate } from '@/utils/format';
import { apiClient } from '@/lib/api-client';

interface PatientStats {
  consultations: number;
  hospitalizations: number;
  admissions: number;
  emergencies: number;
  analyses: number;
  imageries: number;
  prescriptions: number;
  /** null = l'utilisateur n'a pas la permission billing.view */
  billed: number | null;
  paid: number | null;
  lastVisit: string | null;
}

interface StatCard {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  tabKey?: string;
}

interface Props {
  patient: Patient;
  onCardClick?: (tab: string) => void;
}

const CARD_COUNT = 10;

export function PatientStatsCards({ patient, onCardClick }: Props) {
  const [stats, setStats] = useState<PatientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiClient.get<PatientStats>(`/patients/${encodeURIComponent(patient.id)}/stats`);
      setStats(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-gray-100 mb-2" />
            <div className="h-4 w-10 bg-gray-100 rounded mb-1.5" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle size={16} />
          <p className="text-sm">Impossible de charger les statistiques du patient.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    );
  }

  const cards: StatCard[] = [
    { icon: Stethoscope,        label: 'Consultations',    value: stats.consultations,    color: 'text-indigo-600', bg: 'bg-indigo-50',  tabKey: 'consultations' },
    { icon: Bed,                label: 'Hospitalisations', value: stats.hospitalizations, color: 'text-orange-600', bg: 'bg-orange-50',  tabKey: 'hospitalizations' },
    { icon: ArrowRightFromLine, label: 'Admissions',       value: stats.admissions,       color: 'text-blue-600',   bg: 'bg-blue-50',    tabKey: 'admissions' },
    { icon: AlertCircle,        label: 'Urgences',         value: stats.emergencies,      color: 'text-red-600',    bg: 'bg-red-50',     tabKey: 'emergencies' },
    { icon: FlaskConical,       label: 'Analyses',         value: stats.analyses,         color: 'text-teal-600',   bg: 'bg-teal-50',    tabKey: 'laboratory' },
    { icon: Scan,               label: 'Imageries',        value: stats.imageries,        color: 'text-purple-600', bg: 'bg-purple-50',  tabKey: 'imaging' },
    { icon: Pill,               label: 'Prescriptions',    value: stats.prescriptions,    color: 'text-green-600',  bg: 'bg-green-50',   tabKey: 'prescriptions' },
    // Cartes financières : uniquement si le backend a autorisé billing.view (sinon null)
    ...(stats.billed !== null && stats.paid !== null
      ? [
          { icon: Receipt,    label: 'Montant facturé', value: `${Number(stats.billed).toLocaleString('fr-DZ')} DA`, color: 'text-yellow-600',  bg: 'bg-yellow-50',  tabKey: 'billing' },
          { icon: CreditCard, label: 'Montant payé',    value: `${Number(stats.paid).toLocaleString('fr-DZ')} DA`,   color: 'text-emerald-600', bg: 'bg-emerald-50', tabKey: 'payments' },
        ] satisfies StatCard[]
      : []),
    { icon: CalendarClock,      label: 'Dernière visite',  value: stats.lastVisit ? formatDate(stats.lastVisit) : '—',  color: 'text-gray-600',    bg: 'bg-gray-100' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
      {cards.map(card => {
        const Icon = card.icon;
        const clickable = !!card.tabKey && !!onCardClick;
        return (
          <div
            key={card.label}
            onClick={() => clickable && onCardClick!(card.tabKey!)}
            className={cn(
              'bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2 transition-all',
              clickable
                ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm hover:bg-blue-50/20 group'
                : '',
            )}
            title={clickable ? `Voir les ${card.label.toLowerCase()}` : undefined}
          >
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', card.bg,
              clickable ? 'group-hover:scale-105' : '')}>
              <Icon size={15} className={card.color} />
            </div>
            <div>
              <p className={cn('text-lg font-bold text-gray-900 leading-none', clickable ? 'group-hover:text-blue-700 transition-colors' : '')}>{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              {clickable && (
                <p className="text-xs text-blue-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  Cliquer pour voir →
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
