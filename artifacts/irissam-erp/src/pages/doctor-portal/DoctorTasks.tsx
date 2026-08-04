import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { Plus, AlertCircle, RefreshCw, CheckSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type TaskStatus = 'open' | 'in_progress' | 'completed';
type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
type TaskType =
  | 'revoir_resultat'
  | 'contacter_patient'
  | 'refaire_analyse'
  | 'controle_postoperatoire'
  | 'preparer_sortie'
  | 'avis_specialiste'
  | 'renouveler_prescription';

interface Task {
  id: string;
  title: string;
  patient_name: string;
  mrn: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  notes: string;
  due_at: string | null;
  is_overdue: boolean;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
};

const TYPE_LABELS: Record<TaskType, string> = {
  revoir_resultat: 'Revoir résultat',
  contacter_patient: 'Contacter patient',
  refaire_analyse: 'Refaire analyse',
  controle_postoperatoire: 'Contrôle post-op',
  preparer_sortie: 'Préparer sortie',
  avis_specialiste: 'Avis spécialiste',
  renouveler_prescription: 'Renouveler prescription',
};

const TASK_TYPES: TaskType[] = [
  'revoir_resultat',
  'contacter_patient',
  'refaire_analyse',
  'controle_postoperatoire',
  'preparer_sortie',
  'avis_specialiste',
  'renouveler_prescription',
];

const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

interface NewTaskForm {
  patientId: string;
  title: string;
  type: TaskType;
  notes: string;
  dueAt: string;
  priority: TaskPriority;
}

const defaultForm: NewTaskForm = {
  patientId: '',
  title: '',
  type: 'revoir_resultat',
  notes: '',
  dueAt: '',
  priority: 'medium',
};

function TaskCard({
  task,
  onUpdate,
}: {
  task: Task;
  onUpdate: (id: string, status: TaskStatus) => void;
}) {
  const isPast = task.due_at && new Date(task.due_at) < new Date();
  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-3 space-y-2 shadow-sm',
        task.is_overdue ? 'border-red-300' : 'border-gray-100',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm leading-snug">{task.title}</p>
          {(task.patient_name || task.mrn) && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {task.patient_name} {task.mrn && `· ${task.mrn}`}
            </p>
          )}
        </div>
        <span className={cn('text-xs px-1.5 py-0.5 rounded-full flex-shrink-0', PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded">
          {TYPE_LABELS[task.type] ?? task.type}
        </span>
        {task.due_at && (
          <span className={cn('text-xs px-2 py-0.5 rounded', isPast ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')}>
            {new Date(task.due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {task.is_overdue && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-medium">
            En retard
          </span>
        )}
      </div>

      {task.notes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded p-1.5 line-clamp-2">{task.notes}</p>
      )}

      <div className="flex gap-2 pt-0.5">
        {task.status === 'open' && (
          <button
            onClick={() => onUpdate(task.id, 'in_progress')}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Commencer
          </button>
        )}
        {task.status === 'in_progress' && (
          <button
            onClick={() => onUpdate(task.id, 'completed')}
            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Terminer
          </button>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  tasks,
  colorClass,
  onUpdate,
}: {
  title: string;
  tasks: Task[];
  colorClass: string;
  onUpdate: (id: string, status: TaskStatus) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className={cn('rounded-xl p-3 mb-3 flex items-center gap-2', colorClass)}>
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className="ml-auto bg-white/50 text-xs px-1.5 py-0.5 rounded-full font-medium">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-300 text-xs">Aucune tâche</div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={onUpdate} />
          ))
        )}
      </div>
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewTaskForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Task[]>('/api/doctor-portal/tasks');
      setTasks(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateTask = async (id: string, status: TaskStatus) => {
    setUpdating((prev) => new Set(prev).add(id));
    try {
      await apiClient.patch(`/api/doctor-portal/tasks/${id}`, { status });
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    } catch {
      // silent
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post('/api/doctor-portal/tasks', {
        patientId: form.patientId || undefined,
        title: form.title,
        type: form.type,
        notes: form.notes || undefined,
        dueAt: form.dueAt || undefined,
        priority: form.priority,
      });
      setModalOpen(false);
      setForm(defaultForm);
      await fetchTasks();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof NewTaskForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const todoTasks = tasks.filter((t) => t.status === 'open');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed').slice(0, 5);

  // Wrap update to handle optimistic disable
  const onUpdate = (id: string, status: TaskStatus) => {
    if (!updating.has(id)) updateTask(id, status);
  };

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Tâches</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nouvelle tâche
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button onClick={fetchTasks} className="text-sm text-red-600 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-64" />
            ))}
          </div>
        )}

        {/* Kanban */}
        {!loading && !error && (
          tasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckSquare size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">Aucune tâche</p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4">
              <KanbanColumn
                title="À faire"
                tasks={todoTasks}
                colorClass="bg-amber-50 text-amber-800"
                onUpdate={onUpdate}
              />
              <KanbanColumn
                title="En cours"
                tasks={inProgressTasks}
                colorClass="bg-blue-50 text-blue-800"
                onUpdate={onUpdate}
              />
              <KanbanColumn
                title="Terminées"
                tasks={completedTasks}
                colorClass="bg-green-50 text-green-800"
                onUpdate={onUpdate}
              />
            </div>
          )
        )}
      </div>

      {/* New Task Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Nouvelle tâche</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Patient</label>
                <input
                  type="text"
                  value={form.patientId}
                  onChange={(e) => updateField('patientId', e.target.value)}
                  placeholder="UUID du patient (optionnel)"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  required
                  placeholder="Titre de la tâche"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => updateField('type', e.target.value as TaskType)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                  <select
                    value={form.priority}
                    onChange={(e) => updateField('priority', e.target.value as TaskPriority)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Échéance</label>
                <input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => updateField('dueAt', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={3}
                  placeholder="Notes additionnelles…"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DoctorPortalLayout>
  );
}
