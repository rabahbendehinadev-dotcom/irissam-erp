import { createContext, useContext, useState } from 'react';
import type { Site, Building, Floor, Department, SiteFilter } from '@/types';
import { MOCK_SITES, MOCK_BUILDINGS, MOCK_FLOORS, MOCK_DEPARTMENTS } from '@/mock';

interface SiteContextType {
  sites: Site[];
  buildings: Building[];
  floors: Floor[];
  departments: Department[];
  filter: SiteFilter;
  setFilter: (filter: Partial<SiteFilter>) => void;
  activeSite: Site | null;
  activeBuilding: Building | null;
  activeDepartment: Department | null;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilterState] = useState<SiteFilter>({
    siteId: 'site-1',
    buildingId: 'bld-1',
    floorId: 'fl-3',
    departmentId: null,
  });

  const setFilter = (partial: Partial<SiteFilter>) => {
    setFilterState(prev => ({ ...prev, ...partial }));
  };

  const activeSite = MOCK_SITES.find(s => s.id === filter.siteId) ?? null;
  const activeBuilding = MOCK_BUILDINGS.find(b => b.id === filter.buildingId) ?? null;
  const activeDepartment = MOCK_DEPARTMENTS.find(d => d.id === filter.departmentId) ?? null;

  return (
    <SiteContext.Provider value={{
      sites: MOCK_SITES,
      buildings: MOCK_BUILDINGS,
      floors: MOCK_FLOORS,
      departments: MOCK_DEPARTMENTS,
      filter,
      setFilter,
      activeSite,
      activeBuilding,
      activeDepartment,
    }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}
