/** Planning & Gardes page — weekly calendar view with shift management */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, RefreshCw, X, AlertTriangle } from "lucide-react";

const SHIFT_COLORS: Record<string, string> = {
  matin: "bg-yellow-100 text-yellow-800 border-yellow-200",
  apres_midi: "bg-orange-100 text-orange-800 border-orange-200",
  nuit: "bg-indigo-100 text-indigo-800 border-indigo-200",
  garde_12h: "bg-blue-100 text-blue-800 border-blue-200",
  garde_24h: "bg-purple-100 text-purple-800 border-purple-200",
  astreinte: "bg-pink-100 text-pink-800 border-pink-200",
  repos: "bg-gray-100 text-gray-600 border-gray-200",
  formation: "bg-green-100 text-green-800 border-green-200",
};

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const SHIFT_TYPES = ["matin","apres_midi","nuit","garde_12h","garde_24h","astreinte","repos","formation"];

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function PlanningPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: "", shiftDate: formatDate(new Date()), type: "matin", startTime: "08:00", endTime: "16:00", breakMinutes: "60", role: "", notes: "" });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const params = new URLSearchParams({ date_from: formatDate(weekStart), date_to: formatDate(weekEnd), limit: "200" });
  const { data, loading, refetch } = useQuery<any>(`/hr/planning/shifts?${params}`);
  const shifts: any[] = data?.data ?? [];

  // Build week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Group shifts by date
  const shiftsByDate = shifts.reduce((acc: Record<string, any[]>, s: any) => {
    const k = s.shift_date.split("T")[0];
    if (!acc[k]) acc[k] = [];
    acc[k].push(s);
    return acc;
  }, {});

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(getWeekStart(d)); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(getWeekStart(d)); }

  async function createShift() {
    if (!form.employeeId || !form.shiftDate || !form.type) return;
    setSaving(true); setConflictError(null);
    try {
      await apiClient.post("/hr/planning/shifts", { ...form, breakMinutes: parseInt(form.breakMinutes) });
      setShowAdd(false);
      refetch();
    } catch (e: any) {
      if (e.message?.includes("Conflit")) setConflictError(e.message);
    } finally { setSaving(false); }
  }

  async function deleteShift(id: string) {
    await apiClient.delete(`/hr/planning/shifts/${id}`);
    refetch();
  }

  const today = formatDate(new Date());

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planning & Gardes</h1>
          <p className="text-sm text-gray-500">{shifts.length} shift{shifts.length !== 1 ? "s" : ""} cette semaine</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4"/> Ajouter shift
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
        <button onClick={prevWeek} className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft className="w-4 h-4"/></button>
        <div className="text-sm font-semibold text-gray-800">
          {weekStart.toLocaleDateString("fr-FR", { day:"numeric", month:"long" })} — {weekEnd.toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}
        </div>
        <button onClick={nextWeek} className="p-1.5 rounded hover:bg-gray-100"><ChevronRight className="w-4 h-4"/></button>
      </div>

      {/* Legend */}
      <div className="flex gap-2 flex-wrap">
        {SHIFT_TYPES.slice(0,6).map(t => (
          <span key={t} className={`px-2 py-0.5 text-xs rounded border ${SHIFT_COLORS[t]}`}>{t.replace("_"," ")}</span>
        ))}
      </div>

      {/* Calendar Grid — Desktop */}
      <div className="hidden sm:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((d, i) => {
            const isToday = formatDate(d) === today;
            return (
              <div key={i} className={`px-3 py-2 text-center border-r last:border-r-0 border-gray-100 ${isToday ? "bg-blue-50" : ""}`}>
                <p className="text-[10px] text-gray-400 uppercase">{DAYS_FR[d.getDay()]}</p>
                <p className={`text-sm font-bold ${isToday ? "text-blue-600" : "text-gray-700"}`}>{d.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-h-[300px]">
          {weekDays.map((d, i) => {
            const key = formatDate(d);
            const dayShifts = shiftsByDate[key] ?? [];
            const isToday = key === today;
            return (
              <div key={i} className={`p-2 border-r last:border-r-0 border-gray-100 min-h-[200px] space-y-1 ${isToday ? "bg-blue-50/30" : ""}`}>
                {loading && <div className="h-8 bg-gray-100 rounded animate-pulse"/>}
                {dayShifts.map((s: any) => (
                  <div key={s.id} className={`rounded border px-2 py-1 text-[10px] relative group cursor-pointer ${SHIFT_COLORS[s.type] ?? "bg-gray-100 border-gray-200 text-gray-600"}`}>
                    <p className="font-semibold truncate">{s.employee_name?.split(" ").slice(-1)[0]}</p>
                    <p className="opacity-70">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</p>
                    <button onClick={() => deleteShift(s.id)} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-[10px]">×</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* List view — Mobile */}
      <div className="sm:hidden space-y-3">
        {weekDays.map((d, i) => {
          const key = formatDate(d);
          const dayShifts = shiftsByDate[key] ?? [];
          const isToday = key === today;
          return (
            <div key={i} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isToday ? "border-blue-200" : "border-gray-100"}`}>
              <div className={`px-4 py-2 flex items-center gap-2 ${isToday ? "bg-blue-50" : "bg-gray-50"}`}>
                <span className={`text-sm font-semibold ${isToday ? "text-blue-700" : "text-gray-700"}`}>{DAYS_FR[d.getDay()]} {d.getDate()}</span>
                {dayShifts.length > 0 && <span className="ml-auto text-xs text-gray-400">{dayShifts.length} shift{dayShifts.length > 1 ? "s" : ""}</span>}
              </div>
              {dayShifts.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-300">Aucun shift</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {dayShifts.map((s: any) => (
                    <div key={s.id} className="px-4 py-2 flex items-center gap-3">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded border ${SHIFT_COLORS[s.type] ?? ""}`}>{s.type.replace("_"," ")}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{s.employee_name}</p>
                        <p className="text-[10px] text-gray-400">{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Shift Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Nouveau shift</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5"/></button>
            </div>
            {conflictError && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>{conflictError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700">ID Employé *</label>
                <input value={form.employeeId} onChange={e => setForm(f=>({...f,employeeId:e.target.value}))} placeholder="UUID"
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Date *</label>
                <input type="date" value={form.shiftDate} onChange={e => setForm(f=>({...f,shiftDate:e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Type *</label>
                <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {SHIFT_TYPES.map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Heure début</label>
                <input type="time" value={form.startTime} onChange={e => setForm(f=>({...f,startTime:e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Heure fin</label>
                <input type="time" value={form.endTime} onChange={e => setForm(f=>({...f,endTime:e.target.value}))}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Rôle</label>
                <input value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))} placeholder="Ex: Chirurgien"
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createShift} disabled={saving || !form.employeeId || !form.shiftDate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? "…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
