export interface Site {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
}

export interface Building {
  id: string;
  siteId: string;
  name: string;
  code: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  level: number;
}

export interface Department {
  id: string;
  floorId?: string;
  buildingId?: string;
  siteId: string;
  name: string;
  code: string;
  color: string;
  headDoctorId?: string;
  capacity: number;
  isActive: boolean;
}

export interface SiteFilter {
  siteId: string | null;
  buildingId: string | null;
  floorId: string | null;
  departmentId: string | null;
}
