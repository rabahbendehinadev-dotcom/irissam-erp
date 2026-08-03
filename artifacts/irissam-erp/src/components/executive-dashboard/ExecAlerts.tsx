import { DrillTarget } from '@/pages/ExecutiveDashboard';
import { Loader2, AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';

interface Alert {
  id: string; level: 'critical' | 'warning' | 'info';
  module: string; message: string;
  value?: number; threshold?: number;
  action: string; generatedAt: string;
}

interface Props {
  alerts: { count: number; alerts: Alert[] } | null;
  loading: boolean;
  onDrill: (t: DrillTarget) => void;
}

const ALERT_META: Record<string, { metric: string; label: string }> = {
  'occ-90':          { metric: 'bed_occupancy',         label: 'Occupation des lits'       },
  'icu-full':        { metric: 'icu_capacity',           label: 'Réanimation'               },
  'stock-rupture':   { metric: 'stock_critique',         label: 'Articles en rupture'       },
  'biomed-vital':    { metric: 'equipements_en_panne',   label: 'Équipements en panne'      },
  'quality-crit':    { metric: 'incidents_ouverts',      label: 'Incidents qualité critiques'},
  'insurance-overdue':{ metric:'creances_assurance',     label: 'Dossiers assurance'        },
  'hr-understaff':   { metric: 'personnel_absent',       label: 'Effectif'                  },
  'capa-overdue':    { metric: 'capa_retard',            label: 'CAPA en retard'            },
};

const LEVEL_CONFIG = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50',    border: 'border-red-200',  text: 'text-red-700',    badge: 'bg-red-100 text-red-700',    label: 'CRITIQUE' },
  warning:  { icon: AlertCircle,   bg: 'bg-amber-50',  border: 'border-amber-200',text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',label: 'ATTENTION' },
  info:     { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200', text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',  label: 'INFO' },
};

export default function ExecAlerts({ alerts, loading, onDrill }: Props) {
  if (loading && !alerts) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const list: Alert[] = alerts?.alerts ?? [];
  const critical = list.filter(a => a.level === 'critical').length;
  const warning  = list.filter(a => a.level === 'warning').length;

  return (
    <div className="p-4 space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-bold text-red-700">{critical} critique{critical !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-700">{warning} attention</span>
        </div>
        {list.length === 0 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <Info className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold text-green-700">Aucune alerte active ✓</span>
          </div>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {list.map(alert => {
          const cfg = LEVEL_CONFIG[alert.level];
          const Icon = cfg.icon;
          const drill = ALERT_META[alert.id];

          return (
            <div key={alert.id}
              className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border} cursor-pointer hover:shadow-md transition-all`}
              onClick={() => drill && onDrill({ metric: drill.metric, label: drill.label })}>
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.text}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                    <span className="text-xs font-medium text-gray-500">{alert.module}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(alert.generatedAt).toLocaleTimeString('fr-FR')}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${cfg.text}`}>{alert.message}</p>
                  {alert.value !== undefined && alert.threshold !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div className="h-full bg-current rounded-full opacity-70"
                          style={{ width: `${Math.min(100, (alert.value / alert.threshold) * 100)}%` }} />
                      </div>
                      <span className="text-xs opacity-70">{alert.value} / {alert.threshold}</span>
                    </div>
                  )}
                </div>
                {drill && <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.text} opacity-50`} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
