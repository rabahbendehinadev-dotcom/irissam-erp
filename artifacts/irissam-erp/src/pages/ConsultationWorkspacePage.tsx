import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { RefreshCw, Save } from 'lucide-react';
import { ConsultationWorkspace } from '@/components/consultations/ConsultationWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import type { Consultation, ConsultationStatus } from '@/types/consultation';
import { apiClient } from '@/services/api/client';
import { toast } from '@/hooks/use-toast';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Page de l'espace de travail — PostgreSQL est l'unique source de vérité :
// GET direct /consultations/:id (F5 sur un lien profond fonctionne), aucune
// donnée fictive, aucun identifiant de démonstration.

export default function ConsultationWorkspacePage() {
  const [, params] = useRoute('/consultations/:id');
  const id = params?.id;
  // Contrat de route strict : uniquement des UUID PostgreSQL réels.
  const rawId = id ?? '';
  const isValidId = UUID_RE.test(rawId);

  const [consultation, setConsultation] = useState<Consultation | undefined>(undefined);
  const [loading, setLoading] = useState(isValidId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isValidId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiClient.get<Consultation>(`/consultations/${rawId}`)
      .then(c => { if (!cancelled) setConsultation(c); })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rawId, isValidId]);

  // ── Notes du dossier (colonne réelle `notes`) — PATCH /consultations/:id ───
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const consultationId = consultation?.id;
  useEffect(() => {
    setNotesDraft(consultation?.notes ?? '');
    // Re-seed uniquement quand une AUTRE consultation est chargée — pas à
    // chaque frappe (consultation.notes ne bouge qu'après un PATCH réussi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  const handleSaveNotes = async () => {
    if (notesSaving) return;
    setNotesSaving(true);
    try {
      const updated = await apiClient.patch<Consultation>(`/consultations/${rawId}`, { notes: notesDraft });
      setConsultation(prev => prev ? { ...prev, notes: updated.notes, updatedAt: updated.updatedAt } : prev);
      toast({ title: 'Notes enregistrées', description: 'Notes du dossier mises à jour (PostgreSQL + audit).' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: "Échec de l'enregistrement",
        description: e instanceof Error ? e.message : "Impossible d'enregistrer les notes. Veuillez réessayer.",
      });
    } finally {
      setNotesSaving(false);
    }
  };

  // ── Diagnostic (colonne réelle `diagnosis`) — PATCH /consultations/:id ─────
  const [diagnosisSaving, setDiagnosisSaving] = useState(false);

  const handleSaveDiagnosis = async (diagnosis: string): Promise<boolean> => {
    if (diagnosisSaving) return false;
    setDiagnosisSaving(true);
    try {
      const updated = await apiClient.patch<Consultation>(`/consultations/${rawId}`, { diagnosis });
      setConsultation(prev => prev ? { ...prev, diagnosis: updated.diagnosis, updatedAt: updated.updatedAt } : prev);
      toast({ title: 'Diagnostic enregistré', description: 'Diagnostic mis à jour (PostgreSQL + audit).' });
      return true;
    } catch (e) {
      toast({
        variant: 'destructive',
        title: "Échec de l'enregistrement",
        description: e instanceof Error ? e.message : "Impossible d'enregistrer le diagnostic. Veuillez réessayer.",
      });
      return false;
    } finally {
      setDiagnosisSaving(false);
    }
  };

  // ── Statut — le serveur valide l'enum, horodate startedAt/endedAt ──────────
  const handleStatusChange = (status: ConsultationStatus) => {
    apiClient.patch<Consultation>(`/consultations/${rawId}`, { status })
      .then(updated => {
        setConsultation(prev => prev ? { ...prev, ...updated } : updated);
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Échec de la mise à jour',
          description: "Le changement de statut n'a pas été enregistré en base. Veuillez réessayer.",
        });
      });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <RefreshCw size={16} className="animate-spin" /> Chargement de la consultation…
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!consultation) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center text-gray-400">
            <p className="text-xl font-bold mb-2">Consultation introuvable</p>
            <p className="text-sm">
              L'identifiant{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{id}</code>{' '}
              ne correspond à aucune consultation.
            </p>
            {loadError && <p className="text-xs mt-2 text-red-400">{loadError}</p>}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout noPadding>
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
          Notes du dossier
        </label>
        <div className="flex items-start gap-2">
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            rows={2}
            placeholder="Notes cliniques persistées sur la consultation…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y"
          />
          <button
            onClick={handleSaveNotes}
            disabled={notesSaving || (consultation.notes ?? '') === notesDraft}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {notesSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
      <ConsultationWorkspace
        consultation={consultation}
        onStatusChange={handleStatusChange}
        onSaveDiagnosis={handleSaveDiagnosis}
        diagnosisSaving={diagnosisSaving}
        saving={notesSaving || diagnosisSaving}
      />
    </DashboardLayout>
  );
}
