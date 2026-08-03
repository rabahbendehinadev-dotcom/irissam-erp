/** Badges & Contrôle d'accès page */
import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { CreditCard, Plus, RefreshCw, X, Cpu, Zap, Check, AlertTriangle } from "lucide-react";

const DEVICE_TYPES = ["pointeuse","rfid","empreinte","code_pin","qr_code","nfc","camera_ia"];
const BADGE_STATUS: Record<string, { label: string; cls: string }> = {
  actif:     { label: "Actif",     cls: "bg-green-100 text-green-700" },
  inactif:   { label: "Inactif",   cls: "bg-gray-100 text-gray-600" },
  suspendu:  { label: "Suspendu",  cls: "bg-orange-100 text-orange-700" },
  perdu:     { label: "Perdu",     cls: "bg-red-100 text-red-700" },
  expire:    { label: "Expiré",    cls: "bg-amber-100 text-amber-700" },
};

export default function BadgesPage() {
  const [view, setView] = useState<"devices" | "assignments" | "events">("devices");
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceForm, setDeviceForm] = useState({ name: "", deviceCode: "", location: "", type: "rfid", ipAddress: "" });
  const [assignForm, setAssignForm] = useState({ employeeId: "", badgeNumber: "", accessLevel: "standard", validFrom: "", validUntil: "" });
  const [simForm, setSimForm] = useState({ deviceCode: "", badgeNumber: "", eventType: "entry" });
  const [simResult, setSimResult] = useState<string | null>(null);

  const { data: devices, loading: dLoad, refetch: refetchDevices } = useQuery<any[]>("/hr/badges/devices");
  const { data: assData, loading: aLoad, refetch: refetchAss } = useQuery<any>("/hr/badges/assignments?limit=50");
  const { data: evData, loading: eLoad, refetch: refetchEv } = useQuery<any>("/hr/badges/events?limit=50");

  const deviceList: any[] = Array.isArray(devices) ? devices : [];
  const assignments: any[] = assData?.data ?? [];
  const events: any[] = evData?.data ?? [];

  async function createDevice() {
    setSaving(true);
    try { await apiClient.post("/hr/badges/devices", deviceForm); setShowAddDevice(false); refetchDevices(); }
    finally { setSaving(false); }
  }
  async function assignBadge() {
    setSaving(true);
    try { await apiClient.post("/hr/badges/assignments", assignForm); setShowAssign(false); refetchAss(); }
    finally { setSaving(false); }
  }
  async function simulate() {
    setSaving(true); setSimResult(null);
    try {
      const r = await apiClient.post("/hr/badges/simulate", simForm);
      setSimResult(JSON.stringify(r, null, 2));
    } catch (e: any) { setSimResult("Erreur: " + e.message); }
    finally { setSaving(false); }
  }

  const loading = view === "devices" ? dLoad : view === "assignments" ? aLoad : eLoad;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">Badges & Accès</h1></div>
        <div className="flex gap-2">
          <button onClick={() => { view === "devices" ? refetchDevices() : view === "assignments" ? refetchAss() : refetchEv(); }} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowSimulate(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-amber-300 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100">
            <Zap className="w-3.5 h-3.5"/> Simuler
          </button>
          {view === "devices" && <button onClick={() => setShowAddDevice(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4"/> Ajouter appareil</button>}
          {view === "assignments" && <button onClick={() => setShowAssign(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4"/> Assigner badge</button>}
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["devices","assignments","events"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-2 text-xs rounded-lg transition-colors ${view === v ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"}`}>
            {v === "devices" ? "Appareils" : v === "assignments" ? "Badges assignés" : "Événements"}
          </button>
        ))}
      </div>

      {/* Devices */}
      {view === "devices" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && Array.from({length:4}).map((_,i) => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-xl"/>)}
          {!loading && deviceList.length === 0 && (
            <div className="col-span-3 py-12 text-center text-gray-400">
              <Cpu className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p>Aucun appareil enregistré</p>
            </div>
          )}
          {deviceList.map((d: any) => (
            <div key={d.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0"><Cpu className="w-5 h-5 text-indigo-600"/></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{d.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">{d.device_code}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{d.location ?? "—"}</p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${d.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{d.status}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-0.5 bg-gray-100 rounded">{d.type}</span>
                {d.ip_address && <span className="font-mono">{d.ip_address}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assignments */}
      {view === "assignments" && (
        <div className="space-y-3">
          {loading && <div className="h-48 bg-gray-100 animate-pulse rounded-xl"/>}
          {!loading && assignments.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p>Aucun badge assigné</p>
            </div>
          )}
          {assignments.map((a: any) => {
            const st = BADGE_STATUS[a.status] ?? { label: a.status, cls: "bg-gray-100 text-gray-500" };
            const isExpired = a.valid_until && new Date(a.valid_until) < new Date();
            return (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-gray-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{a.employee_name}</p>
                  <p className="text-xs text-gray-400">Badge <span className="font-mono">{a.badge_number}</span> · {a.access_level}</p>
                  {a.valid_until && (
                    <p className={`text-xs ${isExpired ? "text-red-600 flex items-center gap-1" : "text-gray-400"}`}>
                      {isExpired && <AlertTriangle className="w-3 h-3"/>}
                      Valide jusqu'au {new Date(a.valid_until).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                  {a.status === "actif" && (
                    <button onClick={async () => { await apiClient.post(`/hr/badges/assignments/${a.id}/revoke`, {}); refetchAss(); }}
                      className="text-xs text-red-600 hover:underline">Révoquer</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Events */}
      {view === "events" && (
        <div className="space-y-2">
          {loading && <div className="h-48 bg-gray-100 animate-pulse rounded-xl"/>}
          {!loading && events.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <Zap className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p>Aucun événement</p>
            </div>
          )}
          {events.map((ev: any) => (
            <div key={ev.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full shrink-0 ${ev.event_type === "entry" ? "bg-green-500" : ev.event_type === "exit" ? "bg-orange-500" : "bg-red-500"}`}/>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{ev.employee_name ?? "Badge " + ev.badge_number}</p>
                <p className="text-xs text-gray-400">{ev.device_name ?? "—"} · {ev.event_type}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">{new Date(ev.event_time).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</p>
                <p className="text-[10px] text-gray-400">{new Date(ev.event_time).toLocaleDateString("fr-FR")}</p>
              </div>
              {ev.access_status && <span className={`px-2 py-0.5 text-xs rounded-full ${ev.access_status === "granted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{ev.access_status}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Ajouter un appareil</h2><button onClick={() => setShowAddDevice(false)}><X className="w-5 h-5"/></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs font-medium text-gray-700">Nom *</label><input value={deviceForm.name} onChange={e => setDeviceForm(f=>({...f,name:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Code appareil *</label><input value={deviceForm.deviceCode} onChange={e => setDeviceForm(f=>({...f,deviceCode:e.target.value}))} placeholder="Ex: GATE-A1" className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Type</label>
                <select value={deviceForm.type} onChange={e => setDeviceForm(f=>({...f,type:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {DEVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-gray-700">Localisation</label><input value={deviceForm.location} onChange={e => setDeviceForm(f=>({...f,location:e.target.value}))} placeholder="Ex: Entrée principale" className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Adresse IP</label><input value={deviceForm.ipAddress} onChange={e => setDeviceForm(f=>({...f,ipAddress:e.target.value}))} placeholder="192.168.1.x" className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAddDevice(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createDevice} disabled={saving || !deviceForm.name || !deviceForm.deviceCode}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Assigner un badge</h2><button onClick={() => setShowAssign(false)}><X className="w-5 h-5"/></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-700">ID Employé *</label><input value={assignForm.employeeId} onChange={e => setAssignForm(f=>({...f,employeeId:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">N° Badge *</label><input value={assignForm.badgeNumber} onChange={e => setAssignForm(f=>({...f,badgeNumber:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Niveau d'accès</label>
                <select value={assignForm.accessLevel} onChange={e => setAssignForm(f=>({...f,accessLevel:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {["standard","soignant","administrateur","securite","direction","maintenance"].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-700">Valide du</label><input type="date" value={assignForm.validFrom} onChange={e => setAssignForm(f=>({...f,validFrom:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
                <div><label className="text-xs font-medium text-gray-700">Au</label><input type="date" value={assignForm.validUntil} onChange={e => setAssignForm(f=>({...f,validUntil:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={assignBadge} disabled={saving || !assignForm.employeeId || !assignForm.badgeNumber}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : "Assigner"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Modal */}
      {showSimulate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-600"/>Simuler un événement badge</h2><button onClick={() => setShowSimulate(false)}><X className="w-5 h-5"/></button></div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">Mode développement — simule une lecture de badge par un appareil physique.</div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-700">Code appareil *</label><input value={simForm.deviceCode} onChange={e => setSimForm(f=>({...f,deviceCode:e.target.value}))} placeholder="Ex: GATE-A1" className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">N° Badge *</label><input value={simForm.badgeNumber} onChange={e => setSimForm(f=>({...f,badgeNumber:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"/></div>
              <div><label className="text-xs font-medium text-gray-700">Type d'événement</label>
                <select value={simForm.eventType} onChange={e => setSimForm(f=>({...f,eventType:e.target.value}))} className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                  {["entry","exit","denied","alarm"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {simResult && <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-32">{simResult}</pre>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowSimulate(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Fermer</button>
              <button onClick={simulate} disabled={saving || !simForm.deviceCode || !simForm.badgeNumber}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">{saving ? "…" : "Simuler"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
