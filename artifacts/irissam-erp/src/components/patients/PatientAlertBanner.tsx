import { AlertTriangle, Droplets, Heart, Activity, Zap, ShieldAlert, Baby } from 'lucide-react';
import type { Patient } from '@/types';

interface Alert {
  id: string;
  icon: React.ElementType;
  label: string;
  detail?: string;
  color: 'red' | 'orange' | 'yellow' | 'purple' | 'blue' | 'pink';
}

const COLOR_MAP = {
  red:    { bar: 'bg-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: 'text-red-600',    badge: 'bg-red-100 text-red-700' },
  orange: { bar: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500', badge: 'bg-orange-100 text-orange-700' },
  yellow: { bar: 'bg-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
  purple: { bar: 'bg-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  blue:   { bar: 'bg-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   icon: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
  pink:   { bar: 'bg-pink-500',   bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700',   icon: 'text-pink-500',   badge: 'bg-pink-100 text-pink-700' },
};

function buildAlerts(patient: Patient): Alert[] {
  const alerts: Alert[] = [];
  const diseases = (patient.medical?.chronicDiseases ?? []).map(d => d.toLowerCase());
  const allergies = patient.medical?.allergies ?? [];

  if (allergies.length > 0) {
    alerts.push({
      id: 'allergies',
      icon: ShieldAlert,
      label: 'Allergie',
      detail: allergies.join(', '),
      color: 'red',
    });
  }

  if (diseases.some(d => d.includes('diabète') || d.includes('diabete'))) {
    alerts.push({ id: 'diabetes', icon: Activity, label: 'Diabète', color: 'orange' });
  }

  if (diseases.some(d => d.includes('hypertension') || d.includes('hta'))) {
    alerts.push({ id: 'hta', icon: Heart, label: 'Hypertension', color: 'red' });
  }

  const otherChronic = diseases.filter(
    d => !d.includes('diabète') && !d.includes('diabete') && !d.includes('hypertension') && !d.includes('hta')
  );
  if (otherChronic.length > 0) {
    alerts.push({
      id: 'chronic',
      icon: Zap,
      label: 'Maladie chronique',
      detail: patient.medical.chronicDiseases
        .filter(d => !d.toLowerCase().includes('diabète') && !d.toLowerCase().includes('hypertension'))
        .join(', '),
      color: 'yellow',
    });
  }

  const criticalLower = (patient.medical?.criticalNotes ?? '').toLowerCase();
  if (criticalLower.includes('infect') || criticalLower.includes('bacil') || criticalLower.includes('tuberc') || criticalLower.includes('contag')) {
    alerts.push({ id: 'infection', icon: AlertTriangle, label: 'Risque infectieux', color: 'purple' });
  }

  const rareBloodTypes = ['A-', 'B-', 'AB-', 'AB+'];
  if (patient.bloodType && rareBloodTypes.includes(patient.bloodType)) {
    alerts.push({
      id: 'blood',
      icon: Droplets,
      label: 'Groupe sanguin rare',
      detail: `${patient.bloodType}${patient.rhesus ?? ''}`,
      color: 'blue',
    });
  }

  if (criticalLower.includes('gross') || criticalLower.includes('enceinte') || criticalLower.includes('prénat')) {
    alerts.push({ id: 'pregnancy', icon: Baby, label: 'Grossesse', color: 'pink' });
  }

  return alerts;
}

interface Props {
  patient: Patient;
}

export function PatientAlertBanner({ patient }: Props) {
  const alerts = buildAlerts(patient);
  if (alerts.length === 0) return null;

  return (
    <div className="px-6 pb-3 pt-2">
      <div className="flex flex-wrap gap-2">
        {alerts.map(alert => {
          const c = COLOR_MAP[alert.color];
          const Icon = alert.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${c.bg} ${c.border} text-sm font-medium ${c.text}`}
            >
              <Icon size={14} className={c.icon} />
              <span>{alert.label}</span>
              {alert.detail && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${c.badge} font-normal`}>
                  {alert.detail}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
