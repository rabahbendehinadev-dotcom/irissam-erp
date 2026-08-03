/** Pointage / Attendance page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { Clock, LogIn, LogOut, RefreshCw, UserCheck, UserX, Timer, Coffee, Briefcase, Shield } from "lucide-react";

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  present:     { label: "Présent",      cls: "bg-green-100 text-green-700",   icon: UserCheck },
  absent:      { label: "Absent",       cls: "bg-red-100 text-red-700",       icon: UserX },
  retard:      { label: "En retard",    cls: "bg-amber-100 text-amber-700",   icon: Timer },
  sorti:       { label: "Sorti",        cls: "bg-gray-100 text-gray-600",     icon: LogOut },
  en_pause:    { label: "En pause",     cls: "bg-sky-100 text-sky-700",       icon: Coffee },
  en_mission:  { label: "En mission",   cls: "bg-purple-100 text-purple-700", icon: Briefcase },
  en_garde:    { label: "En garde",     cls: "bg-indigo-100 text-indigo-700", icon: Shield },
  non_pointe:  { label: "Non pointé",   cls: "bg-gray-200 text-gray-500",     icon: Clock },
};

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("");
  const [checkInId, setCheckInId] = useState("");
  const [checkOutId, setCheckOutId] = useState("");
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams({ date, ...(statusFilter && { status: statusFilter }), limit: "100" });
  const { data, loading, refetch } = useQuery<any>(`/hr/attendance?${params}`);
  const records: any[] = Array.isArray(data?.data) ? data.data : [];
  const stats = data?.stats ?? {};

  const statCards = [
    { key: "present",    label: "Présents",    icon: UserCheck, cls: "text-green-600 bg-green-50" },
    { key: "absent",     label: "Absents",     icon: UserX,     cls: "text-red-600 bg-red-50" },
    { key: "late",       label: "Retards",     icon: Timer,     cls: "text-amber-600 bg-amber-50" },
    { key: "checked_out",label: "Sortis",      icon: LogOut,    cls: "text-gray-600 bg-gray-50" },
    { key: "on_shift",   label: "En garde",    icon: Shield,    cls: "text-indigo-600 bg-indigo-50" },
    { key: "not_checked_in", label: "Non pointés", icon: Clock, cls: "text-gray-400 bg-gray-50" },
  ];

  async function doCheckIn() {
    if (!checkInId) return;
    setSaving(true);
    try { await apiClient.post("/hr/attendance/check-in", { employeeId: checkInId }); setCheckInId(""); refetch(); }
    finally { setSaving(false); }
  }
  async function doCheckOut() {
    if (!checkOutId) return;
    setSaving(true);
    try { await apiClient.post("/hr/attendance/check-out", { employeeId: checkOutId }); setCheckOutId(""); refetch(); }
    finally { setSaving(false); }
  }

  function fmt(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDuration(mins: number | null) {
    if (!mins) return "—";
    return `${Math.floor(mins/60)}h${mins%60 > 0 ? String(mins%60).padStart(2,"0") : ""}`;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pointage</h1>
          <p className="text-sm text-gray-500">{records.length} enregistrement{records.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
      </div>

      {/* Date + Quick Check-in */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
        <div className="flex gap-2">
          <input value={checkInId} onChange={e => setCheckInId(e.target.value)} placeholder="ID employé — Check-in"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
          <button onClick={doCheckIn} disabled={saving || !checkInId}
            className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
            <LogIn className="w-4 h-4"/>
          </button>
        </div>
        <div className="flex gap-2">
          <input value={checkOutId} onChange={e => setCheckOutId(e.target.value)} placeholder="ID employé — Check-out"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/>
          <button onClick={doCheckOut} disabled={saving || !checkOutId}
            className="px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5">
            <LogOut className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.key} className={`rounded-xl p-3 flex flex-col gap-1 ${s.cls.split(" ")[1]} border border-gray-100 shadow-sm`}>
            <s.icon className={`w-4 h-4 ${s.cls.split(" ")[0]}`}/>
            <p className="text-xl font-bold text-gray-900">{stats[s.key] ?? 0}</p>
            <p className="text-[10px] text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
        <option value="">Tous statuts</option>
        {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>

      {/* Table — desktop */}
      <div className="hidden sm:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employé</th>
              <th className="px-4 py-3 text-center">Département</th>
              <th className="px-4 py-3 text-center">Entrée</th>
              <th className="px-4 py-3 text-center">Sortie</th>
              <th className="px-4 py-3 text-center">Durée</th>
              <th className="px-4 py-3 text-center">Retard</th>
              <th className="px-4 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({length:5}).map((_,i) => (
              <tr key={i} className="animate-pulse">{Array.from({length:7}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td>)}</tr>
            ))}
            {!loading && records.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucun enregistrement pour cette date</td></tr>}
            {records.map((r: any) => {
              const sm = STATUS_META[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 overflow-hidden">
                        {r.photo_url ? <img src={r.photo_url} alt="" className="w-full h-full object-cover"/> : r.employee_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{r.employee_name}</p>
                        <p className="text-[10px] text-gray-400">{r.matricule}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{r.department_name ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-xs font-mono">{fmt(r.check_in)}</td>
                  <td className="px-4 py-3 text-center text-xs font-mono">{fmt(r.check_out)}</td>
                  <td className="px-4 py-3 text-center text-xs font-medium">{fmtDuration(r.total_worked_minutes)}</td>
                  <td className="px-4 py-3 text-center text-xs">
                    {r.late_minutes > 0 ? <span className="text-amber-600 font-medium">{r.late_minutes} min</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sm.cls}`}>{sm.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {records.map((r: any) => {
          const sm = STATUS_META[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
          return (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-gray-800">{r.employee_name}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${sm.cls}`}>{sm.label}</span>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-gray-500">
                <span>↓ {fmt(r.check_in)}</span>
                <span>↑ {fmt(r.check_out)}</span>
                <span>{fmtDuration(r.total_worked_minutes)}</span>
                {r.late_minutes > 0 && <span className="text-amber-600">{r.late_minutes}min retard</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
