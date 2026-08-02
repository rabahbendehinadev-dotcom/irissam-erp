export * from "./generated/api";
// TypeScript types are inferred from the Zod schemas above; we export the
// raw interfaces only for types that don't have a Zod-schema equivalent to
// avoid naming conflicts when a schema and an interface share the same name.
export type {
  AdmissionChartPoint,
  AlertItem,
  BedsSummary,
  BloodBankSummary,
  ConsultationChartPoint,
  DashboardStats,
  HealthStatus,
  MedicationItem,
  MedicationItemStatus,
  MedicationPage,
  OrStatus,
  RecentPatient,
  ServiceChartPoint,
  UpcomingAppointment,
  VehiclesStatus,
} from "./generated/types";
