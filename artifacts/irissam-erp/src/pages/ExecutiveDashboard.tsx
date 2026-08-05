import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import { useLanguage } from '@/i18n';
import { execApi, ExecFilters, Period } from '@/services/api/executive-dashboard';
import ExecOverview    from '@/components/executive-dashboard/ExecOverview';
import ExecMedical     from '@/components/executive-dashboard/ExecMedical';
import ExecCapacity    from '@/components/executive-dashboard/ExecCapacity';
import ExecFinance     from '@/components/executive-dashboard/ExecFinance';
import ExecHR          from '@/components/executive-dashboard/ExecHR';
import ExecStock       from '@/components/executive-dashboard/ExecStock';
import ExecBiomedical  from '@/components/executive-dashboard/ExecBiomedical';
import ExecQuality     from '@/components/executive-dashboard/ExecQuality';
import ExecAlerts      from '@/components/executive-dashboard/ExecAlerts';
import DrillDownDrawer from '@/components/executive-dashboard/DrillDownDrawer';
import ExecFiltersBar  from '@/components/executive-dashboard/ExecFiltersBar';
import { RefreshCw, Maximize2, Pause, Play, FileText, Download } from 'lucide-react';

export interface DrillTarget { metric: string; label: string; }

export default function ExecutiveDashboard() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('0');
  const [filters, setFilters] = useState<ExecFilters>({ period: 'day' });
  const [overview, setOverview] = useState<any>(null);
  const [alerts, setAlerts]     = useState<any>(null);
  const [loadingOv, setLoadingOv] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [paused, setPaused] = useState(false);
  const [drill, setDrill]   = useState<DrillTarget | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tabs = [
    { id: '0', label: t('exec.tab.overview') },
    { id: '1', label: t('exec.tab.medical') },
    { id: '2', label: t('exec.tab.capacity') },
    { id: '3', label: t('exec.tab.finance') },
    { id: '4', label: t('exec.tab.hr') },
    { id: '5', label: t('exec.tab.stock') },
    { id: '6', label: t('exec.tab.biomedical') },
    { id: '7', label: t('exec.tab.quality') },
    { id: '8', label: t('exec.tab.alerts') },
  ];

  const fetchOverview = useCallback(async () => {
    try {
      const [ov, al] = await Promise.allSettled([
        execApi.overview(filters),
        execApi.alerts(filters),
      ]);
      if (ov.status === 'fulfilled') setOverview(ov.value as any);
      if (al.status === 'fulfilled') setAlerts(al.value as any);
      setLastUpdate(new Date());
    } catch { /* silent */ } finally {
      setLoadingOv(false);
    }
  }, [filters]);

  // Initial load + polling
  useEffect(() => {
    setLoadingOv(true);
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (paused) { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(fetchOverview, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOverview, paused]);

  const handleExportPdf = () => {
    const url = execApi.exportPdf(filters);
    window.open(url, '_blank');
  };

  const handleExportExcel = async () => {
    try {
      const res = await execApi.exportExcel(filters);
      const blob = new Blob([JSON.stringify((res as any).data, null, 2)],
        { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `direction_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch { /* silent */ }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const alertCount = alerts?.count ?? 0;
  const critCount  = (alerts?.alerts ?? []).filter((a: any) => a.level === 'critical').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">{t('exec.title')}</h1>
          <p className="text-slate-400 text-xs">{t('exec.subtitle')}</p>
        </div>

        {/* Live clock */}
        <LiveClock />

        {/* Last update */}
        {lastUpdate && (
          <span className="text-xs text-slate-400 hidden sm:block">
            {t('exec.last_update')}: {lastUpdate.toLocaleTimeString()}
          </span>
        )}

        {/* Alert badge */}
        {alertCount > 0 && (
          <button onClick={() => setActiveTab('8')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
              ${critCount > 0 ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-500 hover:bg-amber-400'}`}>
            {critCount > 0 ? '🔴' : '🟡'} {alertCount} alerte{alertCount > 1 ? 's' : ''}
          </button>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => { setLoadingOv(true); fetchOverview(); }}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors" title={t('exec.refresh')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setPaused(p => !p)}
            className={`p-1.5 rounded transition-colors ${paused ? 'bg-amber-600 hover:bg-amber-500' : 'hover:bg-slate-700'}`}
            title={paused ? t('exec.resume') : t('exec.pause')}>
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button onClick={handleExportPdf}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors" title="Export PDF">
            <FileText className="w-4 h-4" />
          </button>
          <button onClick={handleExportExcel}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors" title="Export Excel">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors hidden sm:block" title="Plein écran">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <ExecFiltersBar filters={filters} onChange={setFilters} />

      {/* Tabs */}
      <ScrollableTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === '0' && <ExecOverview  overview={overview} loading={loadingOv} filters={filters} onDrill={setDrill} />}
        {activeTab === '1' && <ExecMedical   filters={filters} />}
        {activeTab === '2' && <ExecCapacity  filters={filters} />}
        {activeTab === '3' && <ExecFinance   filters={filters} onDrill={setDrill} />}
        {activeTab === '4' && <ExecHR        filters={filters} onDrill={setDrill} />}
        {activeTab === '5' && <ExecStock     filters={filters} onDrill={setDrill} />}
        {activeTab === '6' && <ExecBiomedical filters={filters} onDrill={setDrill} />}
        {activeTab === '7' && <ExecQuality   filters={filters} onDrill={setDrill} />}
        {activeTab === '8' && <ExecAlerts    alerts={alerts}   loading={loadingOv} onDrill={setDrill} />}
      </div>

      {/* Drill-down drawer */}
      {drill && (
        <DrillDownDrawer target={drill} filters={filters} onClose={() => setDrill(null)} />
      )}
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center hidden md:block">
      <div className="text-lg font-mono font-bold">{time.toLocaleTimeString('fr-FR')}</div>
      <div className="text-xs text-slate-400">{time.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' })}</div>
    </div>
  );
}
