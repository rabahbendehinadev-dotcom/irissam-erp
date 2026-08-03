/**
 * HR Dashboard — KPI cards, charts, alerts
 */
import { useEffect, useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import {
  Users, UserCheck, UserX, Clock, Plane, AlertCircle,
  FileText, Building2, Timer, TrendingUp, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import { Link } from "wouter";

function safeNum(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

const STATUS_COLORS: Record<string, string> = {
  medical: "#3b82f6",
  paramedical: "#10b981",
  administratif: "#f59e0b",
  technique: "#8b5cf6",
  support: "#ec4899",
};

const PIE_COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316"];

export default function HRDashboard() {
  const { data, loading, error, refetch } = useQuery<any>("/hr/dashboard");

  if (loading) return (
    <div className="p-4 sm:p-6 space-y-4 animate-pulse">
      {Array.from({length:3}).map((_,i)=>(
        <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({length:4}).map((_,j)=><div key={j} className="h-24 bg-gray-100 rounded-xl"/>)}
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="p-6 text-center text-red-500">
      <AlertCircle className="w-8 h-8 mx-auto mb-2"/>
      <p>Erreur de chargement du tableau de bord RH</p>
      <button onClick={refetch} className="mt-3 text-sm text-blue-600 hover:underline">Réessayer</button>
    </div>
  );

  const kpis = data?.kpis ?? {};
  const charts = data?.charts ?? {};
  const alerts = data?.alerts ?? {};

  const kpiCards = [
    { label: "Effectif total",   value: safeNum(kpis.total_employees),    icon: Users,       color: "text-blue-600",  bg: "bg-blue-50" },
    { label: "Présents auj.",    value: safeNum(kpis.present_today),      icon: UserCheck,   color: "text-green-600", bg: "bg-green-50" },
    { label: "Absents auj.",     value: safeNum(kpis.absent_today),       icon: UserX,       color: "text-red-600",   bg: "bg-red-50" },
    { label: "Retards auj.",     value: safeNum(kpis.late_today),         icon: Timer,       color: "text-amber-600", bg: "bg-amber-50" },
    { label: "En congé",         value: safeNum(kpis.on_leave),           icon: Plane,       color: "text-sky-600",   bg: "bg-sky-50" },
    { label: "En garde",         value: safeNum(kpis.on_shift_today),     icon: Clock,       color: "text-indigo-600",bg: "bg-indigo-50" },
    { label: "Contrats exp. 30j",value: safeNum(kpis.contracts_expiring_30d), icon: FileText, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Docs exp. 30j",    value: safeNum(kpis.documents_expiring_30d), icon: FileText, color: "text-pink-600", bg: "bg-pink-50" },
    { label: "Congés en attente",value: safeNum(kpis.leaves_pending),     icon: AlertCircle, color: "text-purple-600",bg: "bg-purple-50" },
    { label: "Postes vacants",   value: safeNum(kpis.vacant_positions),   icon: Building2,   color: "text-rose-600",  bg: "bg-rose-50" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord RH</h1>
          <p className="text-sm text-gray-500">Vue d'ensemble des ressources humaines</p>
        </div>
        <button onClick={refetch} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4"/>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((k, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className={`w-8 h-8 ${k.bg} rounded-lg flex items-center justify-center mb-2`}>
              <k.icon className={`w-4 h-4 ${k.color}`}/>
            </div>
            <p className="text-2xl font-bold text-gray-900">{k.value.toLocaleString("fr-FR")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance Trend */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Présence — 14 derniers jours</h2>
          {charts.attendance_trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={charts.attendance_trend}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="present" stroke="#10b981" name="Présents" dot={false} strokeWidth={2}/>
                <Line dataKey="late"    stroke="#f59e0b" name="Retards" dot={false} strokeWidth={2}/>
                <Line dataKey="absent"  stroke="#ef4444" name="Absents" dot={false} strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
        </div>

        {/* By Category */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Répartition par catégorie</h2>
          {charts.by_category?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={charts.by_category} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={70} label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {charts.by_category.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Absences by month */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Absences — 6 derniers mois</h2>
          {charts.absences_by_month?.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={charts.absences_by_month}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }}/>
                <YAxis tick={{ fontSize: 10 }}/>
                <Tooltip/>
                <Bar dataKey="count" fill="#ef4444" name="Absences" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[160px] flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
        </div>

        {/* By department */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Répartition par département</h2>
          {charts.by_department?.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={charts.by_department} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }}/>
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }}/>
                <Tooltip/>
                <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[160px] flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
        </div>
      </div>

      {/* Alert Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Absent today */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <UserX className="w-4 h-4 text-red-500"/>
            <h3 className="font-semibold text-sm text-gray-800">Absents aujourd'hui</h3>
            <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {alerts.absent_today?.length ?? 0}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.absent_today?.length ? alerts.absent_today.slice(0,5).map((e: any) => (
              <div key={e.id} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                  {e.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{e.name}</p>
                  <p className="text-[10px] text-gray-400">{e.department ?? "—"}</p>
                </div>
              </div>
            )) : <p className="text-xs text-gray-400">Aucun absent aujourd'hui</p>}
          </div>
        </div>

        {/* Contracts expiring */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-orange-500"/>
            <h3 className="font-semibold text-sm text-gray-800">Contrats expirant bientôt</h3>
          </div>
          <div className="space-y-2 text-xs">
            {[
              { label: "Dans 7 jours",  value: alerts.expiring_contracts?.expiring_7d ?? 0,  color: "text-red-600" },
              { label: "Dans 30 jours", value: alerts.expiring_contracts?.expiring_30d ?? 0, color: "text-orange-600" },
              { label: "Dans 90 jours", value: alerts.expiring_contracts?.expiring_90d ?? 0, color: "text-amber-600" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-gray-600">{r.label}</span>
                <span className={`font-bold ${r.color}`}>{safeNum(r.value)}</span>
              </div>
            ))}
            <Link href="/hr/contracts" className="block text-center mt-2 text-blue-600 hover:underline text-xs">
              Voir tous les contrats →
            </Link>
          </div>
        </div>

        {/* Uncovered shifts */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-500"/>
            <h3 className="font-semibold text-sm text-gray-800">Gardes non couvertes</h3>
            <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {alerts.uncovered_shifts?.length ?? 0}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.uncovered_shifts?.length ? alerts.uncovered_shifts.slice(0,5).map((s: any) => (
              <div key={s.id} className="text-xs">
                <p className="font-medium text-gray-800">{s.employee_name}</p>
                <p className="text-gray-400">{s.type} — {s.start_time} — {s.department ?? "—"}</p>
              </div>
            )) : <p className="text-xs text-gray-400">Toutes les gardes sont couvertes</p>}
          </div>
        </div>

        {/* Vacant positions */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-sky-500"/>
            <h3 className="font-semibold text-sm text-gray-800">Postes vacants</h3>
          </div>
          <div className="space-y-2">
            {alerts.vacant_positions?.length ? alerts.vacant_positions.map((p: any) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate">{p.name}</span>
                <span className="font-bold text-sky-600 shrink-0 ml-2">{p.vacancies} vacant{p.vacancies > 1 ? "s" : ""}</span>
              </div>
            )) : <p className="text-xs text-gray-400">Aucun poste vacant</p>}
          </div>
        </div>

        {/* Critical lates */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-amber-500"/>
            <h3 className="font-semibold text-sm text-gray-800">Retards critiques (&gt;30 min)</h3>
          </div>
          <div className="space-y-2">
            {alerts.critical_lates?.length ? alerts.critical_lates.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate">{l.name}</span>
                <span className="font-bold text-amber-600 shrink-0 ml-2">{l.late_minutes} min</span>
              </div>
            )) : <p className="text-xs text-gray-400">Aucun retard critique</p>}
          </div>
        </div>

        {/* Pending leaves */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Plane className="w-4 h-4 text-indigo-500"/>
            <h3 className="font-semibold text-sm text-gray-800">Congés en attente</h3>
            <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {safeNum(alerts.leaves_pending)}
            </span>
          </div>
          <Link href="/hr/leaves" className="block text-center mt-6 text-blue-600 hover:underline text-xs">
            Voir les demandes en attente →
          </Link>
        </div>
      </div>
    </div>
  );
}
