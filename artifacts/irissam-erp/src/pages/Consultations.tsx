import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Download, Stethoscope, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { PatientDrawer } from '@/components/shared/PatientDrawer';
import { ConsultationStats } from '@/components/consultations/ConsultationStats';
import { ConsultationFilters, DEFAULT_FILTERS, type ConsultationFiltersState } from '@/components/consultations/ConsultationFilters';
import { ConsultationTable } from '@/components/consultations/ConsultationTable';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { MOCK_CONSULTATIONS } from '@/mock/consultations';
import type { Consultation, ConsultationStatus } from '@/types/consultation';
import {
  useGetConsultationsList,
  useCreateConsultation,
  useUpdateConsultationStatus,
} from '@workspace/api-client-react';

export default function ConsultationsPage() {
  const [filters, setFilters] = useState<ConsultationFiltersState>(DEFAULT_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null);

  // ── API hooks ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiConsultations, isLoading, isError, refetch } = useGetConsultationsList({} as any);
  const createMutation = useCreateConsultation();
  const updateStatusMutation = useUpdateConsultationStatus();

  // Fall back to mock data if API unavailable
  const consultations = useMemo((): Consultation[] => {
    if (isLoading) return [];
    if (isError) return MOCK_CONSULTATIONS as Consultation[];
    return (apiConsultations as unknown as Consultation[]) ?? [];
  }, [apiConsultations, isLoading, isError]);

  // ── Filter logic ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase();
    return consultations.filter(c => {
      if (filters.status !== 'all' && c.status !== filters.status) return false;
      if (filters.type !== 'all' && c.type !== filters.type) return false;
      if (filters.origin !== 'all' && c.origin !== filters.origin) return false;
      if (filters.doctor !== 'all' && c.doctorName !== filters.doctor) return false;
      if (filters.specialty !== 'all' && c.specialty !== filters.specialty) return false;
      if (filters.dateFrom && c.date < filters.dateFrom) return false;
      if (filters.dateTo && c.date > filters.dateTo) return false;
      if (q && !(
        c.patientName.toLowerCase().includes(q) ||
        c.patientMpi.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q) ||
        c.doctorName.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q) ||
        c.serviceName.toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [consultations, filters]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStatusChange = async (id: string, status: ConsultationStatus) => {
    const rawId = id.replace(/^db-/, '');
    try {
      await updateStatusMutation.mutateAsync({ id: rawId, data: { status } });
      refetch();
    } catch {
      // Ignore — refetch will restore correct state
      refetch();
    }
  };

  const handleCreated = async (partial: Partial<Consultation>) => {
    try {
      await createMutation.mutateAsync({
        data: {
          patientName: partial.patientName ?? 'Patient',
          patientMpi: partial.patientMpi ?? `MPI-NEW-${Date.now()}`,
          doctorName: partial.doctorName ?? '',
          specialty: partial.specialty ?? 'Médecine générale',
          serviceName: partial.serviceName ?? 'Médecine générale',
          date: partial.date ?? new Date().toISOString().slice(0, 10),
          type: partial.type ?? 'consultation_externe',
          origin: partial.origin ?? 'rdv',
          reason: partial.reason ?? '',
          status: partial.status ?? 'en_attente',
          duration: partial.duration ?? undefined,
        },
      });
      await refetch();
    } catch (err) {
      console.error('Failed to create consultation', err);
    }
    setShowForm(false);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleExport = () => {
    const csv = [
      ['N°', 'Date', 'Patient', 'MPI', 'Médecin', 'Spécialité', 'Type', 'Motif', 'Statut', 'Durée'].join(';'),
      ...filtered.map(c => [
        c.number, c.date, c.patientName, c.patientMpi, c.doctorName,
        c.specialty, c.type, `"${c.reason}"`, c.status, c.duration ?? ''
      ].join(';'))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `consultations-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  // ── Quick stats bar ────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = consultations.filter(c => c.date === todayStr);
  const todayTerminees = today.filter(c => c.status === 'terminee').length;
  const todayEnCours   = today.filter(c => c.status === 'en_cours').length;
  const todayEnAttente = today.filter(c => c.status === 'en_attente').length;

  return (
    <DashboardLayout>
      <PageWrapper>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
              <Stethoscope size={20} className="text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Consultations médicales</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Aujourd'hui :&nbsp;
                <span className="font-semibold text-blue-600">{today.length}</span>&nbsp;total ·&nbsp;
                <span className="font-semibold text-green-600">{todayTerminees}</span>&nbsp;terminée{todayTerminees !== 1 ? 's' : ''} ·&nbsp;
                <span className="font-semibold text-yellow-600">{todayEnAttente}</span>&nbsp;en attente ·&nbsp;
                <span className="font-semibold text-blue-600">{todayEnCours}</span>&nbsp;en cours
                {isLoading && (
                  <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" /> Chargement
                  </span>
                )}
                {isError && !isLoading && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Données hors ligne
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Actualiser
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              <Download size={14} /> Exporter CSV
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={15} /> Nouvelle consultation
            </button>
          </div>
        </div>

        {/* Error banner */}
        {isError && !isLoading && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 text-amber-700 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            <span>Connexion API impossible. Affichage des données de démonstration.</span>
            <button onClick={handleRefresh} className="ml-auto text-xs border border-amber-300 px-2.5 py-1 rounded-lg hover:bg-amber-100">
              Réessayer
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {!isLoading && (
          <>
            <div className="mb-6">
              <ConsultationStats />
            </div>

            {/* ── Filters ─────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
              <ConsultationFilters filters={filters} onChange={setFilters} total={filtered.length} />
            </div>

            {/* ── Table ───────────────────────────────────────────────────── */}
            <ConsultationTable
              consultations={filtered}
              onStatusChange={handleStatusChange}
              onPatientClick={setDrawerPatientId}
            />
          </>
        )}
      </PageWrapper>

      {/* ── New consultation modal ─────────────────────────────────────── */}
      {showForm && (
        <ConsultationForm
          onClose={() => setShowForm(false)}
          onCreated={handleCreated}
        />
      )}

      {/* ── Patient drawer ──────────────────────────────────────────────── */}
      <PatientDrawer
        patientId={drawerPatientId}
        onClose={() => setDrawerPatientId(null)}
      />
    </DashboardLayout>
  );
}
