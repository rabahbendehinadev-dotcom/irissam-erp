/**
 * All PostgreSQL Enums — single source of truth for every status / type value.
 * Using pgEnum avoids free-text columns and enforces referential integrity at DB level.
 */
import { pgEnum } from "drizzle-orm/pg-core";

// ─── Identity ────────────────────────────────────────────────────────────────
export const genderEnum              = pgEnum("gender",          ["M", "F"]);
export const bloodTypeEnum           = pgEnum("blood_type_val",  ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
export const rhesusEnum              = pgEnum("rhesus_val",      ["+", "-"]);
export const maritalStatusEnum       = pgEnum("marital_status",  ["celibataire", "marie", "divorce", "veuf"]);
export const idDocumentTypeEnum      = pgEnum("id_document_type",["cni", "passeport", "permis", "autre"]);
export const insuranceTypeEnum       = pgEnum("insurance_type",  ["cnas", "casnos", "mutuelle", "militaire", "gratuite", "payant"]);

// ─── Patient ─────────────────────────────────────────────────────────────────
export const patientStatusEnum       = pgEnum("patient_status",  ["active", "inactive", "archived", "deceased"]);
export const syncStatusEnum          = pgEnum("sync_status_val", ["synced", "pending", "conflict", "error"]);

// ─── Staff / Auth ─────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "admin", "doctor", "nurse", "pharmacist",
  "lab_technician", "radiology_technician",
  "ambulance_driver", "receptionist", "finance",
]);
export const staffStatusEnum = pgEnum("staff_status", [
  "actif", "pause", "intervention_urgente", "conge", "inactif",
]);

// ─── Encounter ────────────────────────────────────────────────────────────────
export const encounterTypeEnum   = pgEnum("encounter_type",   ["urgence", "consultation", "admission", "externe"]);
export const encounterStatusEnum = pgEnum("encounter_status", ["open", "closed", "suspended", "cancelled"]);

// ─── Emergency ────────────────────────────────────────────────────────────────
export const emergencyPriorityEnum = pgEnum("emergency_priority", [
  "P1", "P2", "P3", "P4", "P5", "non_classe",
]);
export const emergencyPatientStatusEnum = pgEnum("emergency_patient_status", [
  "attente_triage", "en_triage", "attente_soins", "en_soins", "observation",
  "hospitalise", "bloque", "reanimation", "transfere", "sorti", "decede",
]);
export const erRoomTypeEnum   = pgEnum("er_room_type",   ["triage", "soins", "reanimation", "observation", "attente"]);
export const erRoomStatusEnum = pgEnum("er_room_status", ["libre", "occupee", "partielle", "nettoyage", "hors_service"]);
export const ambulanceStatusEnum = pgEnum("ambulance_status", [
  "disponible", "vers_hopital", "vers_patient", "sur_place",
  "maintenance", "en_route", "transport_patient", "hors_service",
]);
export const visitCloseReasonEnum = pgEnum("visit_close_reason", [
  "domicile", "hospitalisation", "bloc", "reanimation", "transfert", "deces",
]);

// ─── Admissions ───────────────────────────────────────────────────────────────
export const admissionTypeEnum = pgEnum("admission_type", [
  "hospitalisation", "ambulatoire", "preadmission", "urgence", "maternite", "chirurgie",
]);
export const admissionStatusEnum = pgEnum("admission_status", [
  "active", "preadmission", "ambulatoire", "transferred", "discharged", "cancelled",
]);
export const admissionPriorityEnum = pgEnum("admission_priority", [
  "normal", "urgent", "tres_urgent", "vital",
]);
export const dischargeTypeEnum = pgEnum("discharge_type", [
  "domicile", "transfert_interne", "transfert_externe", "deces", "fugue", "contre_avis",
]);

// ─── Occupancy — Ward Beds ─────────────────────────────────────────────────────
export const occupancyBedStatusEnum = pgEnum("occupancy_bed_status", [
  "disponible", "occupe", "reserve", "nettoyage", "hors_service", "maintenance",
]);
export const bedTypeEnum = pgEnum("bed_type", [
  "standard", "soins_intensifs", "isolement", "maternite", "pediatrie",
]);

// ─── Occupancy — ICU ──────────────────────────────────────────────────────────
export const icuBedStatusEnum = pgEnum("icu_bed_status", [
  "disponible", "occupe", "reserve", "nettoyage", "hors_service",
]);
export const icuTypeEnum = pgEnum("icu_type", ["icu", "hdu", "nicu"]);
export const icuAdmissionStatusEnum = pgEnum("icu_admission_status", [
  "demande", "accepte", "en_cours", "transfere", "sorti",
]);

// ─── Bloc Opératoire ──────────────────────────────────────────────────────────
export const orStatusEnum = pgEnum("or_status", [
  "libre", "reserve", "en_preparation", "en_intervention", "nettoyage", "hors_service", "maintenance",
]);
export const orSlotStatusEnum    = pgEnum("or_slot_status",   ["planifie", "en_cours", "termine", "annule"]);
export const surgicalStatusEnum  = pgEnum("surgical_status",  ["demande", "planifie", "en_cours", "termine", "annule"]);
export const surgicalUrgencyEnum = pgEnum("surgical_urgency", ["elective", "urgent", "emergency"]);

// ─── Clinical Orders ──────────────────────────────────────────────────────────
export const urgencyLevelEnum = pgEnum("urgency_level", ["STAT", "urgent", "routine"]);
export const labStatusEnum    = pgEnum("lab_status",    ["demandee", "prelevee", "en_cours", "validee", "critique", "annulee"]);
export const imagingStatusEnum = pgEnum("imaging_status", ["demandee", "planifiee", "realisee", "interpretee", "annulee"]);
export const prescriptionStatusEnum = pgEnum("prescription_status", ["prescrit", "prepare", "delivre", "annule"]);

// ─── Consultations & RDV ──────────────────────────────────────────────────────
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "confirmed", "pending", "cancelled", "completed", "no_show", "in_progress",
]);
export const consultationTypeEnum = pgEnum("consultation_type", [
  "consultation_externe", "urgence", "hospitalier", "teleconsultation",
]);
export const consultationStatusEnum = pgEnum("consultation_status", [
  "en_attente", "en_cours", "terminee", "planifiee", "annulee",
]);
export const consultationOriginEnum = pgEnum("consultation_origin", [
  "hospitalisation", "urgence", "rdv", "walk_in",
]);

// ─── Facturation ──────────────────────────────────────────────────────────────
export const invoiceStatusEnum  = pgEnum("invoice_status",  ["pending", "paid", "partial", "cancelled", "disputed"]);
export const paymentMethodEnum  = pgEnum("payment_method",  ["cash", "card", "virement", "cheque", "insurance"]);

// ─── Audit & Notifications ─────────────────────────────────────────────────────
export const auditSeverityEnum        = pgEnum("audit_severity",        ["info", "warning", "critical"]);
export const notificationPriorityEnum = pgEnum("notification_priority", ["low", "normal", "high", "urgent", "critical"]);
export const sourceModuleEnum = pgEnum("source_module", [
  "urgences", "consultations", "hospitalisation", "bloc", "reanimation",
  "pharmacie", "laboratoire", "imagerie", "admissions", "system",
]);
