/**
 * Repositories barrel export.
 * Import from here throughout the service layer.
 */

export * from "./types";
export * from "./patient";
export * from "./encounter";
export * from "./admission";
export * from "./occupancyBed";
export * from "./labOrder";
export * from "./imagingOrder";
export * from "./prescription";
export * from "./consultation";
export * from "./appointment";
export * from "./medication";
export * from "./auditLog";
export * from "./userActivityLog";
export * from "./attachment";
export * from "./icuAdmission";
export * from "./surgicalRequest";
export * from "./notification";

// ── Singleton instances (shared across services) ──────────────────────────────
import { PatientRepository }         from "./patient";
import { EncounterRepository }        from "./encounter";
import { AdmissionRepository }        from "./admission";
import { OccupancyBedRepository }     from "./occupancyBed";
import { LabOrderRepository }         from "./labOrder";
import { ImagingOrderRepository }     from "./imagingOrder";
import { PrescriptionRepository }     from "./prescription";
import { ConsultationRepository }     from "./consultation";
import { AppointmentRepository }      from "./appointment";
import { MedicationRepository }       from "./medication";
import { AuditLogRepository }         from "./auditLog";
import { UserActivityLogRepository }  from "./userActivityLog";
import { AttachmentRepository }       from "./attachment";
import { IcuAdmissionRepository }     from "./icuAdmission";
import { SurgicalRequestRepository }  from "./surgicalRequest";
import { NotificationRepository }     from "./notification";

export const repos = {
  patient:          new PatientRepository(),
  encounter:        new EncounterRepository(),
  admission:        new AdmissionRepository(),
  occupancyBed:     new OccupancyBedRepository(),
  labOrder:         new LabOrderRepository(),
  imagingOrder:     new ImagingOrderRepository(),
  prescription:     new PrescriptionRepository(),
  consultation:     new ConsultationRepository(),
  appointment:      new AppointmentRepository(),
  medication:       new MedicationRepository(),
  auditLog:         new AuditLogRepository(),
  userActivityLog:  new UserActivityLogRepository(),
  attachment:       new AttachmentRepository(),
  icuAdmission:     new IcuAdmissionRepository(),
  surgicalRequest:  new SurgicalRequestRepository(),
  notification:     new NotificationRepository(),
} as const;
