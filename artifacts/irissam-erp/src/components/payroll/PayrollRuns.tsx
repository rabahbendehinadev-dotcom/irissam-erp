import { useState, useEffect } from 'react';
import { payrollApi, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_COLORS, MONTH_NAMES_FR, formatAmount, type PayrollRun, type PayrollAnomaly } from '@/services/api/payroll';
import { Play, CheckCircle, Lock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Users, X } from 'lucide-react';

const WORKFLOW_STEPS = [
  { key: 'draft',              label: 'Brouillon' },
  { key: 'collecting_data',    label: 'Collecte' },
  { key: 'calculated',         label: 'Calculé' },
  { key: 'under_review',       label: 'Révision' },
  { key: 'hr_approved',        label: 'RH ✓' },
  { key: 'finance_approved',   label: 'Finance ✓' },
  { key: 'locked',             label: 'Verrouillé' },
  { key: 'payslips_generated', label: 'Bulletins' },
  { key: 'paid',               label: 'Payé' },
];

export default function PayrollRuns() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRunPeriodId, setNewRunPeriodId] = useState('');
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [runsRes, periodsRes] = await Promise.all([
        payrollApi.getRuns({ limit: 30 }),
        payrollApi.getPeriods({ limit: 24 }),
      ]);
      setRuns(Array.isArray(runsRes?.data) ? runsRes.data : []);
      setPeriods(Array.isArray(periodsRes?.data) ? periodsRes.data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadRun = async (id: string) => {
    try {
      const r = await payrollApi.getRun(id);
      setSelectedRun(r);
    } catch {}
  };

  const action = async (fn: () => Promise<any>, label: string) => {
    setActionLoading(label);
    try {
      await fn();
      await load();
      if (selectedRun) await loadRun(selectedRun.id);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(''); setShowComment(''); setComment(''); }
  };

  const statusIndex = (s: string) => WORKFLOW_STEPS.findIndex(w => w.key === s);

  const RunActions = ({ run }: { run: PayrollRun }) => {
    const idx = statusIndex(run.status);
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {run.status === 'draft' && (
          <button onClick={() => action(() => payrollApi.collectData(run.id), 'collect')} disabled={!!actionLoading} className="btn-sm bg-blue-600 text-white">
            {actionLoading === 'collect' ? '...' : <><Play className="w-3 h-3" /> Collecter données</>}
          </button>
        )}
        {['draft','collecting_data'].includes(run.status) && (
          <button onClick={() => action(() => payrollApi.calculateRun(run.id), 'calc')} disabled={!!actionLoading} className="btn-sm bg-purple-600 text-white">
            {actionLoading === 'calc' ? 'Calcul...' : <><Play className="w-3 h-3" /> Calculer</>}
          </button>
        )}
        {run.status === 'calculated' && (
          <button onClick={() => action(() => payrollApi.reviewRun(run.id), 'review')} disabled={!!actionLoading} className="btn-sm bg-orange-500 text-white">
            Passer en révision
          </button>
        )}
        {run.status === 'under_review' && (
          <>
            {showComment === 'hr' ? (
              <div className="flex gap-2 items-center">
                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire (optionnel)" className="border rounded px-2 py-1 text-xs" />
                <button onClick={() => action(() => payrollApi.hrApprove(run.id, comment), 'hr')} className="btn-sm bg-teal-600 text-white">Confirmer ✓</button>
                <button onClick={() => setShowComment('')} className="btn-sm border"><X className="w-3 h-3"/></button>
              </div>
            ) : (
              <button onClick={() => setShowComment('hr')} disabled={run.total_critical_anomalies > 0} className="btn-sm bg-teal-600 text-white disabled:opacity-40">
                <CheckCircle className="w-3 h-3" /> Approbation RH
              </button>
            )}
          </>
        )}
        {run.status === 'hr_approved' && (
          <>
            {showComment === 'finance' ? (
              <div className="flex gap-2 items-center">
                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire" className="border rounded px-2 py-1 text-xs" />
                <button onClick={() => action(() => payrollApi.financeApprove(run.id, comment), 'finance')} className="btn-sm bg-indigo-600 text-white">Confirmer ✓</button>
                <button onClick={() => setShowComment('')} className="btn-sm border"><X className="w-3 h-3"/></button>
              </div>
            ) : (
              <button onClick={() => setShowComment('finance')} className="btn-sm bg-indigo-600 text-white">
                <CheckCircle className="w-3 h-3" /> Approbation Finance
              </button>
            )}
          </>
        )}
        {run.status === 'finance_approved' && (
          <button onClick={() => action(() => payrollApi.lockRun(run.id), 'lock')} className="btn-sm bg-gray-800 text-white">
            <Lock className="w-3 h-3" /> Verrouiller
          </button>
        )}
        {run.status === 'locked' && (
          <button onClick={() => action(() => payrollApi.generatePayslips(run.id), 'payslips')} disabled={!!actionLoading} className="btn-sm bg-cyan-600 text-white">
            {actionLoading === 'payslips' ? 'Génération...' : 'Générer bulletins'}
          </button>
        )}
        {run.status === 'payslips_generated' && (
          <button onClick={() => action(() => payrollApi.markPaid(run.id), 'paid')} className="btn-sm bg-green-600 text-white">
            Marquer payé ✓
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Runs de paie</h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Play className="w-4 h-4" /> Nouveau run
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
          <h3 className="font-medium">Créer un run</h3>
          <select value={newRunPeriodId} onChange={e => setNewRunPeriodId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— Sélectionner une période —</option>
            {periods.filter(p => !['locked','paid','cancelled'].includes(p.status)).map(p => (
              <option key={p.id} value={p.id}>{MONTH_NAMES_FR[p.month-1]} {p.year} — {PAYROLL_STATUS_LABELS[p.status]}</option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg">Annuler</button>
            <button onClick={() => {
              if (!newRunPeriodId) return;
              action(() => payrollApi.createRun({ periodId: newRunPeriodId }), 'create').then(() => setShowCreate(false));
            }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Créer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucun run trouvé</div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <div key={run.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {run.month ? `${MONTH_NAMES_FR[run.month-1]} ${run.year}` : 'Run'} — {run.label || `Run #${run.run_number || ''}`}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      <span><Users className="w-3 h-3 inline" /> {run.total_employees} employés</span>
                      <span>Brut: <strong>{formatAmount(run.total_brut)}</strong></span>
                      <span>Net: <strong className="text-green-700">{formatAmount(run.total_net)}</strong></span>
                      {(run.total_critical_anomalies || 0) > 0 && (
                        <span className="text-red-600 font-medium"><AlertTriangle className="w-3 h-3 inline" /> {run.total_critical_anomalies} critique(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PAYROLL_STATUS_COLORS[run.status]}`}>
                      {PAYROLL_STATUS_LABELS[run.status]}
                    </span>
                    <button onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)} className="p-1 hover:bg-gray-100 rounded">
                      {expandedRun === run.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Workflow progress */}
                <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                  {WORKFLOW_STEPS.filter(s => s.key !== 'cancelled').map((step, i) => {
                    const current = statusIndex(run.status);
                    const done = i < current;
                    const active = i === current;
                    return (
                      <div key={step.key} className="flex items-center flex-shrink-0">
                        <div className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${active ? 'bg-blue-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {step.label}
                        </div>
                        {i < WORKFLOW_STEPS.length - 2 && <div className={`w-3 h-px mx-0.5 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />}
                      </div>
                    );
                  })}
                </div>

                <RunActions run={run} />
              </div>

              {/* Expanded employee runs */}
              {expandedRun === run.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Détail par employé</h4>
                  {!selectedRun || selectedRun.id !== run.id ? (
                    <button onClick={() => loadRun(run.id)} className="text-sm text-blue-600 hover:underline">Charger les données...</button>
                  ) : !selectedRun.employee_runs?.length ? (
                    <div className="text-sm text-gray-400">Aucun employé calculé</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b">
                            <th className="text-left py-1 pr-3">Employé</th>
                            <th className="text-right pr-3">Jours</th>
                            <th className="text-right pr-3">Brut</th>
                            <th className="text-right pr-3">Retenues</th>
                            <th className="text-right pr-3 font-semibold">Net</th>
                            <th className="text-center">Anomalies</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedRun.employee_runs!.map(er => (
                            <tr key={er.id} className={er.has_anomalies ? 'bg-red-50' : ''}>
                              <td className="py-1.5 pr-3">
                                <div className="font-medium text-gray-800">{er.last_name} {er.first_name}</div>
                                <div className="text-gray-400">{er.matricule} · {er.department_name}</div>
                              </td>
                              <td className="text-right pr-3 text-gray-600">{parseFloat(String(er.days_worked)).toFixed(1)}/{parseFloat(String(er.working_days)).toFixed(0)}</td>
                              <td className="text-right pr-3">{formatAmount(er.brut)}</td>
                              <td className="text-right pr-3 text-red-600">{formatAmount(er.total_deductions)}</td>
                              <td className="text-right pr-3 font-semibold text-green-700">{formatAmount(er.net)}</td>
                              <td className="text-center">
                                {er.has_anomalies ? (
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${er.critical_anomaly_count > 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {er.anomaly_count}
                                  </span>
                                ) : <span className="text-green-500">✓</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Anomalies panel */}
                  {selectedRun?.id === run.id && selectedRun.anomalies && selectedRun.anomalies.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Anomalies ({selectedRun.anomalies.length})</h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selectedRun.anomalies.map(a => (
                          <div key={a.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${a.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' : a.severity === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                            <div>
                              <span className="font-medium">[{a.code}]</span> {a.message}
                              {a.last_name && <span className="ml-1 text-gray-500">— {a.last_name} {a.first_name}</span>}
                            </div>
                            {!a.resolved && (
                              <button onClick={() => {
                                const note = window.prompt('Note de résolution (optionnel):') ?? '';
                                action(() => payrollApi.resolveAnomaly(run.id, a.id, note), 'resolve_' + a.id);
                              }} className="flex-shrink-0 px-2 py-0.5 bg-white border rounded text-xs hover:bg-gray-50">
                                Résoudre
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`.btn-sm { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; border:1px solid transparent; } .btn-sm:disabled { opacity:0.5; cursor:not-allowed; } .btn-sm.border { border-color:#d1d5db; color:#374151; background:white; }`}</style>
    </div>
  );
}
