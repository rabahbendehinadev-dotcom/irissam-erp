import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import type { TabBarItem } from '@/components/ui/ScrollableTabBar';
import { AlertTriangle, AlertCircle, RefreshCw, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

type ResultTab = 'new' | 'critical' | 'read' | 'lab' | 'imaging';

interface LabResult {
  id: string;
  patient_name: string;
  mrn: string;
  test_name: string;
  result_value: string;
  result_unit: string;
  result_at: string;
  is_critical: boolean;
  acknowledged_at: string | null;
  status: string;
}

interface ImagingResult {
  id: string;
  patient_name: string;
  mrn: string;
  exam_type: string;
  body_part: string;
  reported_at: string;
  status: string;
  acknowledged_at: string | null;
}

interface ResultsData {
  labs: LabResult[];
  imaging: ImagingResult[];
}

const TABS: TabBarItem[] = [
  { id: 'new', label: 'Nouveaux' },
  { id: 'critical', label: 'Critiques' },
  { id: 'read', label: 'Lus' },
  { id: 'lab', label: 'Laboratoire' },
  { id: 'imaging', label: 'Imagerie' },
];

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function DoctorResults() {
  const [activeTab, setActiveTab] = useState<ResultTab>('new');
  const [data, setData] = useState<ResultsData>({ labs: [], imaging: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ResultsData>(`/api/doctor-portal/results?tab=${activeTab}`);
      const d = res as ResultsData;
      setData({
        labs: Array.isArray(d?.labs) ? d.labs : [],
        imaging: Array.isArray(d?.imaging) ? d.imaging : [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const acknowledge = async (id: string, type: 'lab' | 'imaging') => {
    setAcknowledging((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/api/doctor-portal/results/${id}/acknowledge?type=${type}`, {});
      if (type === 'lab') {
        setData((prev) => ({
          ...prev,
          labs: prev.labs.map((l) => l.id === id ? { ...l, acknowledged_at: new Date().toISOString() } : l),
        }));
      } else {
        setData((prev) => ({
          ...prev,
          imaging: prev.imaging.map((i) => i.id === id ? { ...i, acknowledged_at: new Date().toISOString() } : i),
        }));
      }
    } catch {
      // silent fail
    } finally {
      setAcknowledging((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const criticalUnack = data.labs.filter((l) => l.is_critical && !l.acknowledged_at);

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Résultats</h1>

        {/* Critical banner */}
        {criticalUnack.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 animate-pulse" />
            <p className="text-red-700 font-medium text-sm">
              ⚠ {criticalUnack.length} résultat(s) critique(s) non acquitté(s). Action requise.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button onClick={fetchResults} className="text-sm text-red-600 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        <ScrollableTabBar tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as ResultTab)} />

        {/* Labs table */}
        {(activeTab === 'new' || activeTab === 'critical' || activeTab === 'read' || activeTab === 'lab') && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <FlaskConical size={16} className="text-purple-500" />
              <h2 className="font-semibold text-gray-800">Laboratoire</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Patient', 'MRN', 'Analyse', 'Date résultat', 'Résultat', 'Statut', 'Actions'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : data.labs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                        Aucun résultat
                      </td>
                    </tr>
                  ) : (
                    data.labs.map((lab) => (
                      <tr
                        key={lab.id}
                        className={cn(
                          'hover:bg-gray-50',
                          lab.is_critical && !lab.acknowledged_at && 'bg-red-50',
                        )}
                      >
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{lab.patient_name}</td>
                        <td className="px-3 py-3 text-gray-500 font-mono text-xs">{lab.mrn}</td>
                        <td className="px-3 py-3 text-gray-700">{lab.test_name}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                          {lab.result_at ? new Date(lab.result_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className={cn('px-3 py-3 font-semibold', lab.is_critical ? 'text-red-600' : 'text-gray-800')}>
                          <span className="flex items-center gap-1.5">
                            {lab.is_critical && !lab.acknowledged_at && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                            {lab.result_value} {lab.result_unit}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            lab.acknowledged_at ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                          )}>
                            {lab.acknowledged_at ? 'Acquitté' : lab.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {!lab.acknowledged_at && (
                            <button
                              onClick={() => acknowledge(lab.id, 'lab')}
                              disabled={acknowledging.has(lab.id)}
                              className="text-xs px-2 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {acknowledging.has(lab.id) ? '...' : 'Accuser réception'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Imaging table */}
        {(activeTab === 'new' || activeTab === 'read' || activeTab === 'imaging') && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Imagerie</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Patient', 'MRN', 'Examen', 'Zone', 'Date rapport', 'Statut', 'Actions'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : data.imaging.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                        Aucun résultat
                      </td>
                    </tr>
                  ) : (
                    data.imaging.map((img) => (
                      <tr key={img.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{img.patient_name}</td>
                        <td className="px-3 py-3 text-gray-500 font-mono text-xs">{img.mrn}</td>
                        <td className="px-3 py-3 text-gray-700">{img.exam_type}</td>
                        <td className="px-3 py-3 text-gray-500">{img.body_part}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                          {img.reported_at ? new Date(img.reported_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            img.acknowledged_at ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                          )}>
                            {img.acknowledged_at ? 'Acquitté' : img.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {!img.acknowledged_at && (
                            <button
                              onClick={() => acknowledge(img.id, 'imaging')}
                              disabled={acknowledging.has(img.id)}
                              className="text-xs px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {acknowledging.has(img.id) ? '...' : 'Accuser réception'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DoctorPortalLayout>
  );
}
