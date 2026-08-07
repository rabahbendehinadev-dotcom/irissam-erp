import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { RefreshCw, Save } from 'lucide-react';
import { getAllConsultations, getNurseVitals } from '@/mock/consultations';
import { ConsultationWorkspace } from '@/components/consultations/ConsultationWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import type { Consultation, ConsultationStatus } from '@/types/consultation';
import { apiClient } from '@/services/api/client';
import { useAppointmentStore } from '@/store/AppointmentStore';
import { toast } from '@/hooks/use-toast';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Merge nurse-entered vitals overlay into a consultation object (non-destructive). */
function withNurseVitals(c: Consultation): Consultation {
  const nurseVitals = getNurseVitals(c.id);
  return nurseVitals ? { ...c, vitalSigns: nurseVitals } : c;
}

// The workspace page renders inside DashboardLayout (sidebar present).
// ConsultationWorkspace owns its own sticky header and tab bar.

export default function ConsultationWorkspacePage() {
  const [, params] = useRoute('/consultations/:id');
  const id = params?.id;
  const rawId = (id ?? '').replace(/^db-/, '');
  const isDbBacked = UUID_RE.test(rawId);

  // 1. Mock data (c-* IDs) — merge nurse vitals overlay immediately
  const mockMatch = !isDbBacked && id ? getAllConsultations().find(c => c.id === id) : undefined;

  const [consultation, setConsultation] = useState<Consultation | undefined>(
    mockMatch ? withNurseVitals(mockMatch as Consultation) : undefined
  );
  const [loading, setLoading] = useState(isDbBacked);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 2. Consultations réelles (UUID) : GET direct /consultations/:id.
  //    PostgreSQL est la source de vérité — F5 sur un lien profond fonctionne,
  //    plus de dépendance au cache de la liste des consultations.
  useEffect(() => {
    if (!isDbBacked) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiClient.get<Consultation>(`/consultations/${rawId}`)
      .then(c => { if (!cancelled) setConsultation(withNurseVitals(c)); })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rawId, isDbBacked]);

  // ── Appointment sync — must be called unconditionally (Rules of Hooks) ─────
  const { syncFromConsultation } = useAppointmentStore();

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

  const handleChange = (updated: Consultation) => {
    setConsultation(updated);
  };

  const handleStatusChange = (status: ConsultationStatus) => {
    const appointmentId = consultation?.appointmentId;

    if (isDbBacked) {
      // Persistance réelle : le serveur valide l'enum, horodate startedAt /
      // endedAt et calcule la durée ; l'état local reflète la réponse DB.
      apiClient.patch<Consultation>(`/consultations/${rawId}`, { status })
        .then(updated => {
          setConsultation(prev => withNurseVitals(prev ? { ...prev, ...updated } : updated));
          if (appointmentId) syncFromConsultation(appointmentId, status);
        })
        .catch(() => {
          toast({
            variant: 'destructive',
            title: 'Échec de la mise à jour',
            description: "Le changement de statut n'a pas été enregistré en base. Veuillez réessayer.",
          });
        });
      return;
    }

    // Consultations mock (c-*) : comportement local historique
    setConsultation(prev => prev ? {
      ...prev,
      status,
      startedAt: status === 'en_cours' && !prev.startedAt ? new Date().toISOString() : prev.startedAt,
      endedAt:   status === 'terminee' ? new Date().toISOString() : prev.endedAt,
      duration:  status === 'terminee' && prev.startedAt
        ? Math.round((Date.now() - new Date(prev.startedAt).getTime()) / 60000)
        : prev.duration,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    } : prev);

    if (appointmentId) {
      syncFromConsultation(appointmentId, status);
    }
  };

  const handleSaveNotes = async () => {
    if (!isDbBacked || notesSaving) return;
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
      {isDbBacked && (
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
      )}
      <ConsultationWorkspace
        consultation={consultation}
        onChange={handleChange}
        onStatusChange={handleStatusChange}
      />
    </DashboardLayout>
  );
}
