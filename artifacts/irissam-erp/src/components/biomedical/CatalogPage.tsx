import { useState, useEffect } from "react";
import { getBiomedCategories, getBiomedManufacturers, getBiomedModels, getBiomedLocations,
         createBiomedCategory, createBiomedManufacturer, createBiomedModel, createBiomedLocation } from "@/services/api/biomedical";

type SubTab = "categories" | "manufacturers" | "models" | "locations";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id:"categories",   label:"Catégories" },
  { id:"manufacturers",label:"Fabricants" },
  { id:"models",       label:"Modèles" },
  { id:"locations",    label:"Localisations" },
];

export default function CatalogPage() {
  const [tab, setTab] = useState<SubTab>("categories");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string,string>>({});
  const [categories, setCategories] = useState<any>(null);
  const [manufacturers, setManufacturers] = useState<any>(null);
  const [models, setModels] = useState<any>(null);
  const [locations, setLocations] = useState<any>(null);
  const [catTick, setCatTick] = useState(0);
  const [mfrTick, setMfrTick] = useState(0);
  const [modTick, setModTick] = useState(0);
  const [locTick, setLocTick] = useState(0);

  useEffect(() => { getBiomedCategories().then(setCategories).catch(() => {}); }, [catTick]);
  useEffect(() => { getBiomedManufacturers().then(setManufacturers).catch(() => {}); }, [mfrTick]);
  useEffect(() => { getBiomedModels({}).then(setModels).catch(() => {}); }, [modTick]);
  useEffect(() => { getBiomedLocations().then(setLocations).catch(() => {}); }, [locTick]);

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (tab === "categories")    { await createBiomedCategory(form);    setCatTick(t=>t+1); }
      if (tab === "manufacturers") { await createBiomedManufacturer(form); setMfrTick(t=>t+1); }
      if (tab === "models")        { await createBiomedModel(form);        setModTick(t=>t+1); }
      if (tab === "locations")     { await createBiomedLocation(form);     setLocTick(t=>t+1); }
      setShowCreate(false); setForm({});
    } catch(err: any) { alert(err?.response?.data?.error ?? "Erreur"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setShowCreate(false); }}
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-all ${tab===t.id ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Ajouter
        </button>
      </div>

      {tab === "categories" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories?.data?.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg mb-2" style={{ background: `${c.color}20` }}>
                <div className="w-3 h-3 rounded-full m-2.5" style={{ background: c.color }}/>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
              <p className="text-xs font-mono text-gray-400">{c.code}</p>
              {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === "manufacturers" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {manufacturers?.data?.map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="font-semibold text-gray-900">{m.name}</p>
              <p className="text-xs font-mono text-gray-400">{m.code} {m.country && `· ${m.country}`}</p>
              {m.contact_name && <p className="text-xs text-gray-500 mt-1">👤 {m.contact_name}</p>}
              {m.phone && <p className="text-xs text-gray-500">📞 {m.phone}</p>}
              {m.email && <p className="text-xs text-gray-500">✉ {m.email}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === "models" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Modèle","Fabricant","Référence","Vie (ans)","Int. maint.","Int. calib."].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {models?.data?.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{m.manufacturer_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{m.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.expected_life_years ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.maintenance_interval_days ? `${m.maintenance_interval_days}j` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.calibration_interval_days ? `${m.calibration_interval_days}j` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "locations" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations?.data?.map((l: any) => (
            <div key={l.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="font-semibold text-gray-900">{l.name}</p>
              <p className="text-xs font-mono text-gray-400">{l.code}</p>
              {l.department && <p className="text-xs text-gray-500 mt-1">🏥 {l.department}</p>}
              {l.building && <p className="text-xs text-gray-400">🏢 Bât. {l.building}{l.floor ? `, Ét. ${l.floor}` : ""}{l.room ? `, Salle ${l.room}` : ""}</p>}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Ajouter {SUB_TABS.find(t=>t.id===tab)?.label}</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Code *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.code ?? ""} onChange={f("code")} /></div>
                <div><label className="text-xs font-medium text-gray-600">Nom *</label>
                  <input required className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.name ?? ""} onChange={f("name")} /></div>
              </div>
              {tab === "categories" && (
                <div><label className="text-xs font-medium text-gray-600">Couleur</label>
                  <input type="color" className="mt-1 w-12 h-8 border border-gray-300 rounded cursor-pointer" value={form.color ?? "#6366F1"} onChange={f("color")} /></div>
              )}
              {tab === "manufacturers" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-gray-600">Pays</label>
                    <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.country ?? ""} onChange={f("country")} /></div>
                  <div><label className="text-xs font-medium text-gray-600">Email</label>
                    <input type="email" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.email ?? ""} onChange={f("email")} /></div>
                </div>
              )}
              {tab === "models" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-gray-600">Référence</label>
                    <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.reference ?? ""} onChange={f("reference")} /></div>
                  <div><label className="text-xs font-medium text-gray-600">Durée vie (ans)</label>
                    <input type="number" min="1" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.expected_life_years ?? ""} onChange={f("expected_life_years")} /></div>
                </div>
              )}
              {tab === "locations" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-gray-600">Service</label>
                    <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.department ?? ""} onChange={f("department")} /></div>
                  <div><label className="text-xs font-medium text-gray-600">Bâtiment</label>
                    <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.building ?? ""} onChange={f("building")} /></div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
