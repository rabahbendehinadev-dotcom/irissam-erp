/**
 * Seed script for IRISSAM Hospital ERP demo data.
 * Run: pnpm --filter @workspace/db seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import {
  patientsTable,
  appointmentsTable,
  alertsTable,
  admissionsTable,
  medicationsTable,
  dailyStatsTable,
  bedsTable,
  operatingRoomsTable,
  bloodBankTable,
  vehiclesTable,
  consultationsTable,
} from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function daysAgo(n: number, hour = 8, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function today(hour = 8, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  return d.toISOString().slice(0, 10);
}

const todayStr = dateStr(0);
const yestStr = dateStr(1);

async function seed() {
  console.log("🌱 Seeding database...");

  // ── Patients ────────────────────────────────────────────────────────────────
  await db.delete(patientsTable);
  await db.insert(patientsTable).values([
    {
      name: "Mohamed Ali", age: 45, fileNumber: "2026-1258", service: "Médecine interne",
      registeredAt: daysAgo(0, 10, 10), updatedAt: daysAgo(0, 10, 10),
      firstName: "Mohamed", lastName: "Ali", mpiId: "MPI-2026-000001", internalNumber: "INT-001",
      gender: "M", dateOfBirth: "1981-03-15", phone: "0555 12 34 56", bloodType: "B+",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Fatima Zahra", age: 32, fileNumber: "2026-1257", service: "Gynécologie",
      registeredAt: daysAgo(0, 10, 5), updatedAt: daysAgo(0, 10, 5),
      firstName: "Fatima", lastName: "Zahra", mpiId: "MPI-2026-000002", internalNumber: "INT-002",
      gender: "F", dateOfBirth: "1992-07-22", phone: "0555 23 45 67", bloodType: "A+",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Ahmed Benali", age: 60, fileNumber: "2026-1256", service: "Cardiologie",
      registeredAt: daysAgo(0, 9, 58), updatedAt: daysAgo(0, 9, 58),
      firstName: "Ahmed", lastName: "Benali", mpiId: "MPI-2026-000003", internalNumber: "INT-003",
      gender: "M", dateOfBirth: "1964-11-08", phone: "0555 34 56 78", bloodType: "O+",
      status: "active", syncStatus: "pending", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Amina Kherfi", age: 27, fileNumber: "2026-1255", service: "Pédiatrie",
      registeredAt: daysAgo(0, 9, 50), updatedAt: daysAgo(0, 9, 50),
      firstName: "Amina", lastName: "Kherfi", mpiId: "MPI-2026-000004", internalNumber: "INT-004",
      gender: "F", dateOfBirth: "1999-05-30", phone: "0555 45 67 89", bloodType: "A-",
      status: "active", syncStatus: "synced", isIncomplete: true, potentialDuplicate: false,
    },
    {
      name: "Yacine Hamdi", age: 36, fileNumber: "2026-1254", service: "Chirurgie",
      registeredAt: daysAgo(0, 9, 45), updatedAt: daysAgo(0, 9, 45),
      firstName: "Yacine", lastName: "Hamdi", mpiId: "MPI-2026-000005", internalNumber: "INT-005",
      gender: "M", dateOfBirth: "1988-09-12", phone: "0555 56 78 90", bloodType: "B-",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Rachid Tlemcani", age: 52, fileNumber: "2026-1253", service: "Médecine interne",
      registeredAt: daysAgo(1, 14, 30), updatedAt: daysAgo(1, 14, 30),
      firstName: "Rachid", lastName: "Tlemcani", mpiId: "MPI-2026-000006", internalNumber: "INT-006",
      gender: "M", dateOfBirth: "1974-02-20", phone: "0555 67 89 01", bloodType: "O-",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Nadia Boudjemaa", age: 41, fileNumber: "2026-1252", service: "Gynécologie",
      registeredAt: daysAgo(1, 11, 20), updatedAt: daysAgo(1, 11, 20),
      firstName: "Nadia", lastName: "Boudjemaa", mpiId: "MPI-2026-000007", internalNumber: "INT-007",
      gender: "F", dateOfBirth: "1983-06-14", phone: "0555 78 90 12", bloodType: "AB+",
      status: "active", syncStatus: "pending", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Karim Meziane", age: 28, fileNumber: "2026-1251", service: "Urgences",
      registeredAt: daysAgo(1, 8, 15), updatedAt: daysAgo(1, 8, 15),
      firstName: "Karim", lastName: "Meziane", mpiId: "MPI-2026-000008", internalNumber: "INT-008",
      gender: "M", dateOfBirth: "1998-12-03", phone: "0555 89 01 23", bloodType: null,
      status: "active", syncStatus: "synced", isIncomplete: true, potentialDuplicate: false,
    },
    {
      name: "Souad Ferhat", age: 65, fileNumber: "2026-1250", service: "Cardiologie",
      registeredAt: daysAgo(2, 16, 0), updatedAt: daysAgo(2, 16, 0),
      firstName: "Souad", lastName: "Ferhat", mpiId: "MPI-2026-000009", internalNumber: "INT-009",
      gender: "F", dateOfBirth: "1959-04-18", phone: "0555 90 12 34", bloodType: "A+",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Omar Hadjadj", age: 19, fileNumber: "2026-1249", service: "Orthopédie",
      registeredAt: daysAgo(2, 9, 0), updatedAt: daysAgo(2, 9, 0),
      firstName: "Omar", lastName: "Hadjadj", mpiId: "MPI-2026-000010", internalNumber: "INT-010",
      gender: "M", dateOfBirth: "2007-01-25", phone: "0555 01 23 45", bloodType: "O+",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Houria Mansouri", age: 38, fileNumber: "2026-1248", service: "Neurologie",
      registeredAt: daysAgo(3, 10, 0), updatedAt: daysAgo(3, 10, 0),
      firstName: "Houria", lastName: "Mansouri", mpiId: "MPI-2026-000011", internalNumber: "INT-011",
      gender: "F", dateOfBirth: "1986-08-07", phone: "0555 12 34 00", bloodType: "B+",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Abdelkader Ziani", age: 72, fileNumber: "2026-1247", service: "Cardiologie",
      registeredAt: daysAgo(3, 8, 30), updatedAt: daysAgo(3, 8, 30),
      firstName: "Abdelkader", lastName: "Ziani", mpiId: "MPI-2026-000012", internalNumber: "INT-012",
      gender: "M", dateOfBirth: "1952-10-30", phone: "0555 23 45 11", bloodType: "AB-",
      status: "inactive", syncStatus: "conflict", isIncomplete: false, potentialDuplicate: true,
    },
    {
      name: "Samira Bouchama", age: 44, fileNumber: "2026-1246", service: "Endocrinologie",
      registeredAt: daysAgo(4, 11, 0), updatedAt: daysAgo(4, 11, 0),
      firstName: "Samira", lastName: "Bouchama", mpiId: "MPI-2026-000013", internalNumber: "INT-013",
      gender: "F", dateOfBirth: "1980-03-22", phone: "0555 34 56 22", bloodType: "A-",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Farid Aissaoui", age: 55, fileNumber: "2026-1245", service: "Pneumologie",
      registeredAt: daysAgo(4, 9, 30), updatedAt: daysAgo(4, 9, 30),
      firstName: "Farid", lastName: "Aissaoui", mpiId: "MPI-2026-000014", internalNumber: "INT-014",
      gender: "M", dateOfBirth: "1969-07-11", phone: "0555 45 67 33", bloodType: "O+",
      status: "active", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
    {
      name: "Lynda Chibane", age: 31, fileNumber: "2026-1244", service: "Pédiatrie",
      registeredAt: daysAgo(5, 10, 0), updatedAt: daysAgo(5, 10, 0),
      firstName: "Lynda", lastName: "Chibane", mpiId: "MPI-2026-000015", internalNumber: "INT-015",
      gender: "F", dateOfBirth: "1993-11-19", phone: "0555 56 78 44", bloodType: "B+",
      status: "archived", syncStatus: "synced", isIncomplete: false, potentialDuplicate: false,
    },
  ]);
  console.log("✅ Patients seeded (15)");

  // ── Appointments ─────────────────────────────────────────────────────────────
  await db.delete(appointmentsTable);
  await db.insert(appointmentsTable).values([
    {
      patientName: "Fatima Zahra", patientFirstName: "Fatima", patientLastName: "Zahra",
      service: "Gynécologie", departmentName: "Gynécologie",
      doctorName: "Dr. Dubois", scheduledAt: today(10, 30), status: "confirmed",
      duration: 30, notes: null,
    },
    {
      patientName: "Mohamed Ali", patientFirstName: "Mohamed", patientLastName: "Ali",
      service: "Cardiologie", departmentName: "Cardiologie",
      doctorName: "Dr. Martin", scheduledAt: today(11, 0), status: "confirmed",
      duration: 45, notes: "Contrôle post-opératoire",
    },
    {
      patientName: "Amina Kherfi", patientFirstName: "Amina", patientLastName: "Kherfi",
      service: "Pédiatrie", departmentName: "Pédiatrie",
      doctorName: "Dr. Leroy", scheduledAt: today(11, 30), status: "pending",
      duration: 20, notes: null,
    },
    {
      patientName: "Yacine Hamdi", patientFirstName: "Yacine", patientLastName: "Hamdi",
      service: "Chirurgie", departmentName: "Chirurgie",
      doctorName: "Dr. Moreau", scheduledAt: today(14, 0), status: "confirmed",
      duration: 60, notes: "Consultation pré-opératoire",
    },
    {
      patientName: "Rachid Tlemcani", patientFirstName: "Rachid", patientLastName: "Tlemcani",
      service: "Médecine interne", departmentName: "Médecine interne",
      doctorName: "Dr. Bernard", scheduledAt: today(15, 30), status: "pending",
      duration: 30, notes: null,
    },
    {
      patientName: "Nadia Boudjemaa", patientFirstName: "Nadia", patientLastName: "Boudjemaa",
      service: "Gynécologie", departmentName: "Gynécologie",
      doctorName: "Dr. Dubois", scheduledAt: today(16, 0), status: "confirmed",
      duration: 30, notes: null,
    },
    {
      patientName: "Souad Ferhat", patientFirstName: "Souad", patientLastName: "Ferhat",
      service: "Cardiologie", departmentName: "Cardiologie",
      doctorName: "Dr. Martin", scheduledAt: today(9, 0), status: "confirmed",
      duration: 45, notes: "Bilan cardiologique annuel",
    },
    {
      patientName: "Houria Mansouri", patientFirstName: "Houria", patientLastName: "Mansouri",
      service: "Neurologie", departmentName: "Neurologie",
      doctorName: "Dr. Dupont", scheduledAt: today(8, 30), status: "completed",
      duration: 40, notes: null,
    },
    {
      patientName: "Ahmed Benali", patientFirstName: "Ahmed", patientLastName: "Benali",
      service: "Cardiologie", departmentName: "Cardiologie",
      doctorName: "Dr. Martin", scheduledAt: daysAgo(1, 9, 0), status: "completed",
      duration: 30, notes: null,
    },
    {
      patientName: "Karim Meziane", patientFirstName: "Karim", patientLastName: "Meziane",
      service: "Urgences", departmentName: "Urgences",
      doctorName: "Dr. Saadi", scheduledAt: daysAgo(1, 14, 30), status: "cancelled",
      duration: 20, notes: "Patient absent",
    },
    {
      patientName: "Omar Hadjadj", patientFirstName: "Omar", patientLastName: "Hadjadj",
      service: "Orthopédie", departmentName: "Orthopédie",
      doctorName: "Dr. Roux", scheduledAt: daysAgo(2, 10, 0), status: "completed",
      duration: 30, notes: null,
    },
    {
      patientName: "Samira Bouchama", patientFirstName: "Samira", patientLastName: "Bouchama",
      service: "Endocrinologie", departmentName: "Endocrinologie",
      doctorName: "Dr. Chouiref", scheduledAt: daysAgo(2, 11, 30), status: "no_show",
      duration: 30, notes: null,
    },
  ]);
  console.log("✅ Appointments seeded (12)");

  // ── Alerts ──────────────────────────────────────────────────────────────────
  await db.delete(alertsTable);
  await db.insert(alertsTable).values([
    {
      type: "critical", title: "Résultat d'analyse critique",
      detail: "Patient : Fatima Zahra – Potassium élevé (6.8 mmol/L)",
      description: "Patient Fatima Zahra – Kaliémie à 6.8 mmol/L (N: 3.5–5.0). Prise en charge urgente requise.",
      isActive: true, isRead: false,
      severity: "critical", category: "lab",
      createdAt: today(10, 15),
    },
    {
      type: "warning", title: "Stock critique – Paracétamol 1G",
      detail: "Pharmacie : 15 unités restantes (seuil minimum : 50)",
      description: "Le stock de Paracétamol 1G est tombé à 15 unités, sous le seuil de 50. Commande urgente nécessaire.",
      isActive: true, isRead: false,
      severity: "high", category: "stock",
      createdAt: today(9, 45),
    },
    {
      type: "warning", title: "Médicament proche péremption",
      detail: "Amoxicilline 500mg – Expire le 20/08/2026",
      description: "L'Amoxicilline 500mg (lot AMX-2026-08) expire dans moins de 30 jours.",
      isActive: true, isRead: false,
      severity: "medium", category: "medication",
      createdAt: today(9, 30),
    },
    {
      type: "critical", title: "Service de réanimation saturé",
      detail: "Service Réanimation – Capacité 100% (24/24 lits occupés)",
      description: "Le service de réanimation est à 100% de sa capacité. Aucun lit disponible pour les nouvelles admissions.",
      isActive: true, isRead: false,
      severity: "critical", category: "capacity",
      createdAt: today(9, 20),
    },
    {
      type: "info", title: "Intervention chirurgicale en retard",
      detail: "Bloc 2 – Début prévu à 09:00 – Retard estimé 45 min",
      description: "L'intervention au Bloc 2 prévue à 09:00 est retardée d'environ 45 minutes.",
      isActive: true, isRead: false,
      severity: "medium", category: "schedule",
      createdAt: today(9, 10),
    },
    {
      type: "warning", title: "Défaillance équipement – ECG Bloc C",
      detail: "Électrocardiographe du Bloc C hors service",
      description: "L'électrocardiographe du Bloc C signale une erreur de calibration. Maintenance préventive requise.",
      isActive: true, isRead: true,
      severity: "high", category: "equipment",
      createdAt: daysAgo(0, 8, 0),
    },
    {
      type: "warning", title: "Stock faible – Sérum physiologique",
      detail: "Pharmacie : 18 poches restantes (seuil : 40)",
      description: "Sérum physiologique 250ml : 18 poches en stock, seuil d'alerte à 40.",
      isActive: true, isRead: true,
      severity: "medium", category: "stock",
      createdAt: daysAgo(0, 7, 30),
    },
    {
      type: "info", title: "Résultats d'imagerie disponibles",
      detail: "Patient : Ahmed Benali – Scanner thoracique",
      description: "Le scanner thoracique d'Ahmed Benali est disponible depuis le service d'imagerie médicale.",
      isActive: true, isRead: true,
      severity: "low", category: "lab",
      createdAt: daysAgo(1, 11, 0),
    },
  ]);
  console.log("✅ Alerts seeded (8)");

  // ── Consultations ────────────────────────────────────────────────────────────
  await db.delete(consultationsTable);
  await db.insert(consultationsTable).values([
    {
      number: "CON-2026-0001", patientName: "Houria Mansouri", patientMpi: "MPI-2026-000011",
      doctorName: "Dr. Dupont", specialty: "Neurologie", serviceName: "Neurologie",
      date: todayStr, scheduledAt: today(8, 30), startedAt: today(8, 35), endedAt: today(9, 15),
      duration: 40, type: "consultation_externe", origin: "rdv",
      reason: "Céphalées chroniques, bilan neurologique", status: "terminee", syncStatus: "synced",
      createdAt: today(8, 0), updatedAt: today(9, 15),
    },
    {
      number: "CON-2026-0002", patientName: "Souad Ferhat", patientMpi: "MPI-2026-000009",
      doctorName: "Dr. Martin", specialty: "Cardiologie", serviceName: "Cardiologie",
      date: todayStr, scheduledAt: today(9, 0), startedAt: today(9, 5),
      duration: null, type: "consultation_externe", origin: "rdv",
      reason: "Bilan cardiologique annuel, contrôle HTA", status: "en_cours", syncStatus: "pending",
      createdAt: today(8, 30), updatedAt: today(9, 5),
    },
    {
      number: "CON-2026-0003", patientName: "Fatima Zahra", patientMpi: "MPI-2026-000002",
      doctorName: "Dr. Dubois", specialty: "Gynécologie", serviceName: "Gynécologie",
      date: todayStr, scheduledAt: today(10, 30),
      duration: null, type: "consultation_externe", origin: "rdv",
      reason: "Suivi grossesse – 2ème trimestre", status: "en_attente", syncStatus: "synced",
      createdAt: today(8, 0), updatedAt: today(8, 0),
    },
    {
      number: "CON-2026-0004", patientName: "Mohamed Ali", patientMpi: "MPI-2026-000001",
      doctorName: "Dr. Martin", specialty: "Cardiologie", serviceName: "Cardiologie",
      date: todayStr, scheduledAt: today(11, 0),
      duration: null, type: "consultation_externe", origin: "rdv",
      reason: "Contrôle post-opératoire – pontage coronarien", status: "planifiee", syncStatus: "synced",
      createdAt: today(8, 0), updatedAt: today(8, 0),
    },
    {
      number: "CON-2026-0005", patientName: "Karim Meziane", patientMpi: "MPI-2026-000008",
      doctorName: "Dr. Saadi", specialty: "Urgences", serviceName: "Urgences",
      date: todayStr, scheduledAt: today(7, 45), startedAt: today(7, 50), endedAt: today(8, 20),
      duration: 30, type: "urgence", origin: "urgence",
      reason: "Douleurs abdominales aiguës", status: "terminee", syncStatus: "synced",
      createdAt: today(7, 30), updatedAt: today(8, 20),
    },
    {
      number: "CON-2026-0006", patientName: "Ahmed Benali", patientMpi: "MPI-2026-000003",
      doctorName: "Dr. Martin", specialty: "Cardiologie", serviceName: "Cardiologie",
      date: yestStr, scheduledAt: daysAgo(1, 9, 0), startedAt: daysAgo(1, 9, 5), endedAt: daysAgo(1, 9, 35),
      duration: 30, type: "consultation_externe", origin: "rdv",
      reason: "Palpitations, bilan ECG", status: "terminee", syncStatus: "synced",
      createdAt: daysAgo(1, 8, 0), updatedAt: daysAgo(1, 9, 35),
    },
    {
      number: "CON-2026-0007", patientName: "Omar Hadjadj", patientMpi: "MPI-2026-000010",
      doctorName: "Dr. Roux", specialty: "Orthopédie", serviceName: "Orthopédie",
      date: yestStr, scheduledAt: daysAgo(1, 14, 0), startedAt: daysAgo(1, 14, 5), endedAt: daysAgo(1, 14, 35),
      duration: 30, type: "consultation_externe", origin: "rdv",
      reason: "Douleurs genou droit, suite entorse", status: "terminee", syncStatus: "synced",
      createdAt: daysAgo(1, 8, 0), updatedAt: daysAgo(1, 14, 35),
    },
    {
      number: "CON-2026-0008", patientName: "Nadia Boudjemaa", patientMpi: "MPI-2026-000007",
      doctorName: "Dr. Dubois", specialty: "Gynécologie", serviceName: "Gynécologie",
      date: yestStr, scheduledAt: daysAgo(1, 11, 0), startedAt: daysAgo(1, 11, 10), endedAt: daysAgo(1, 11, 50),
      duration: 40, type: "consultation_externe", origin: "rdv",
      reason: "Douleurs pelviennes, bilan échographique", status: "terminee", syncStatus: "synced",
      createdAt: daysAgo(1, 8, 0), updatedAt: daysAgo(1, 11, 50),
    },
    {
      number: "CON-2026-0009", patientName: "Samira Bouchama", patientMpi: "MPI-2026-000013",
      doctorName: "Dr. Chouiref", specialty: "Endocrinologie", serviceName: "Endocrinologie",
      date: dateStr(2), scheduledAt: daysAgo(2, 10, 0), startedAt: daysAgo(2, 10, 5), endedAt: daysAgo(2, 10, 50),
      duration: 45, type: "consultation_externe", origin: "rdv",
      reason: "Suivi diabète type 2, HbA1c", status: "terminee", syncStatus: "synced",
      createdAt: daysAgo(2, 8, 0), updatedAt: daysAgo(2, 10, 50),
    },
    {
      number: "CON-2026-0010", patientName: "Farid Aissaoui", patientMpi: "MPI-2026-000014",
      doctorName: "Dr. Kaci", specialty: "Pneumologie", serviceName: "Pneumologie",
      date: dateStr(2), scheduledAt: daysAgo(2, 14, 30), startedAt: daysAgo(2, 14, 35), endedAt: daysAgo(2, 15, 5),
      duration: 30, type: "consultation_externe", origin: "rdv",
      reason: "Dyspnée à l'effort, bilan spirométrique", status: "terminee", syncStatus: "synced",
      createdAt: daysAgo(2, 8, 0), updatedAt: daysAgo(2, 15, 5),
    },
  ]);
  console.log("✅ Consultations seeded (10)");

  // ── Admissions (mix: current + discharged) ─────────────────────────────────
  await db.delete(admissionsTable);
  const services = [
    "Médecine interne", "Chirurgie", "Pédiatrie", "Gynécologie",
    "Cardiologie", "Urgences", "Neurologie", "Orthopédie",
    "Pneumologie", "Réanimation",
  ];
  const patientNames = [
    "Ahmed Benali", "Houria Mansouri", "Abdelkader Ziani", "Samira Bouchama",
    "Farid Aissaoui", "Lynda Chibane", "Omar Hadjadj", "Karim Meziane",
    "Souad Ferhat", "Rachid Tlemcani", "Nadia Boudjemaa", "Mohamed Ali",
    "Fatima Zahra", "Amina Kherfi", "Yacine Hamdi",
  ];

  const admissions = [
    { patientName: patientNames[0],  service: services[4], admittedAt: daysAgo(5), dischargedAt: null },
    { patientName: patientNames[1],  service: services[6], admittedAt: daysAgo(4), dischargedAt: null },
    { patientName: patientNames[2],  service: services[4], admittedAt: daysAgo(3), dischargedAt: null },
    { patientName: patientNames[3],  service: services[8], admittedAt: daysAgo(2), dischargedAt: null },
    { patientName: patientNames[4],  service: services[8], admittedAt: daysAgo(2), dischargedAt: null },
    { patientName: patientNames[5],  service: services[2], admittedAt: daysAgo(1), dischargedAt: null },
    { patientName: patientNames[6],  service: services[7], admittedAt: daysAgo(1), dischargedAt: null },
    { patientName: patientNames[7],  service: services[5], admittedAt: today(7, 0), dischargedAt: null },
    { patientName: patientNames[8],  service: services[4], admittedAt: today(7, 30), dischargedAt: null },
    { patientName: patientNames[9],  service: services[0], admittedAt: today(8, 0), dischargedAt: null },
    { patientName: patientNames[10], service: services[1], admittedAt: daysAgo(3), dischargedAt: daysAgo(1, 12) },
    { patientName: patientNames[11], service: services[0], admittedAt: daysAgo(4), dischargedAt: daysAgo(2, 10) },
    { patientName: patientNames[12], service: services[3], admittedAt: daysAgo(2), dischargedAt: today(9, 0) },
    { patientName: patientNames[13], service: services[2], admittedAt: daysAgo(3), dischargedAt: daysAgo(1, 14) },
    { patientName: patientNames[14], service: services[1], admittedAt: daysAgo(5), dischargedAt: daysAgo(3, 11) },
    { patientName: patientNames[0],  service: services[9], admittedAt: daysAgo(6), dischargedAt: daysAgo(4, 9) },
    { patientName: patientNames[1],  service: services[5], admittedAt: daysAgo(6), dischargedAt: daysAgo(4, 16) },
  ];
  await db.insert(admissionsTable).values(admissions);
  console.log("✅ Admissions seeded (17)");

  // ── Medications ─────────────────────────────────────────────────────────────
  await db.delete(medicationsTable);
  await db.insert(medicationsTable).values([
    { name: "Paracétamol 1G",          quantity: 15,  unit: "boîtes", lowStockThreshold: 50,  expiryDate: "2027-03-01" },
    { name: "Amoxicilline 500mg",       quantity: 20,  unit: "boîtes", lowStockThreshold: 30,  expiryDate: "2026-08-20" },
    { name: "Sérum physiologique 250ml",quantity: 18,  unit: "poches", lowStockThreshold: 40,  expiryDate: "2026-12-01" },
    { name: "Ibuprofène 400mg",         quantity: 120, unit: "boîtes", lowStockThreshold: 50,  expiryDate: "2027-06-01" },
    { name: "Metformine 850mg",         quantity: 85,  unit: "boîtes", lowStockThreshold: 30,  expiryDate: "2027-01-01" },
    { name: "Oméprazole 20mg",          quantity: 200, unit: "boîtes", lowStockThreshold: 50,  expiryDate: "2027-09-01" },
    { name: "Amlodipine 5mg",           quantity: 75,  unit: "boîtes", lowStockThreshold: 30,  expiryDate: "2027-04-01" },
  ]);
  console.log("✅ Medications seeded (7)");

  // ── Daily Stats (last 7 days) ────────────────────────────────────────────────
  await db.delete(dailyStatsTable);
  await db.insert(dailyStatsTable).values([
    { date: dateStr(6), consultations: 340, rendezVous: 180, admissions: 18, sorties: 12, analyses: 128, imaging: 52, invoices: 130, revenueDA: 1_850_000 },
    { date: dateStr(5), consultations: 380, rendezVous: 200, admissions: 20, sorties: 15, analyses: 135, imaging: 58, invoices: 145, revenueDA: 1_920_000 },
    { date: dateStr(4), consultations: 420, rendezVous: 230, admissions: 22, sorties: 18, analyses: 140, imaging: 62, invoices: 148, revenueDA: 2_010_000 },
    { date: dateStr(3), consultations: 350, rendezVous: 190, admissions: 19, sorties: 14, analyses: 130, imaging: 55, invoices: 138, revenueDA: 1_890_000 },
    { date: dateStr(2), consultations: 430, rendezVous: 250, admissions: 23, sorties: 17, analyses: 142, imaging: 64, invoices: 152, revenueDA: 2_080_000 },
    { date: dateStr(1), consultations: 460, rendezVous: 280, admissions: 21, sorties: 16, analyses: 148, imaging: 67, invoices: 155, revenueDA: 2_120_000 },
    { date: dateStr(0), consultations: 312, rendezVous: 186, admissions: 10, sorties:  9, analyses: 145, imaging: 68, invoices: 156, revenueDA: 2_145_000 },
  ]);
  console.log("✅ Daily stats seeded (7 days)");

  // ── Beds (by service) ─────────────────────────────────────────────────────────
  await db.delete(bedsTable);
  await db.insert(bedsTable).values([
    { service: "Médecine interne", totalBeds: 80, occupiedBeds: 62, cleaningBeds: 5, outOfServiceBeds: 2 },
    { service: "Chirurgie",        totalBeds: 60, occupiedBeds: 48, cleaningBeds: 3, outOfServiceBeds: 1 },
    { service: "Pédiatrie",        totalBeds: 50, occupiedBeds: 38, cleaningBeds: 2, outOfServiceBeds: 0 },
    { service: "Gynécologie",      totalBeds: 40, occupiedBeds: 30, cleaningBeds: 2, outOfServiceBeds: 1 },
    { service: "Cardiologie",      totalBeds: 35, occupiedBeds: 28, cleaningBeds: 1, outOfServiceBeds: 0 },
    { service: "Urgences",         totalBeds: 30, occupiedBeds: 25, cleaningBeds: 1, outOfServiceBeds: 1 },
    { service: "Neurologie",       totalBeds: 30, occupiedBeds: 22, cleaningBeds: 1, outOfServiceBeds: 0 },
    { service: "Orthopédie",       totalBeds: 30, occupiedBeds: 24, cleaningBeds: 0, outOfServiceBeds: 0 },
    { service: "Pneumologie",      totalBeds: 25, occupiedBeds: 19, cleaningBeds: 0, outOfServiceBeds: 0 },
    { service: "Réanimation",      totalBeds: 24, occupiedBeds: 24, cleaningBeds: 0, outOfServiceBeds: 0 },
    { service: "Endocrinologie",   totalBeds: 16, occupiedBeds: 12, cleaningBeds: 0, outOfServiceBeds: 0 },
  ]);
  console.log("✅ Beds seeded (11 services)");

  // ── Operating Rooms ──────────────────────────────────────────────────────────
  await db.delete(operatingRoomsTable);
  await db.insert(operatingRoomsTable).values([
    { name: "Bloc 1", status: "occupied" },
    { name: "Bloc 2", status: "prep" },
    { name: "Bloc 3", status: "available" },
    { name: "Bloc 4", status: "available" },
    { name: "Bloc 5", status: "occupied" },
    { name: "Bloc 6", status: "available" },
    { name: "Bloc 7", status: "available" },
    { name: "Bloc 8", status: "available" },
  ]);
  console.log("✅ Operating rooms seeded (8)");

  // ── Blood Bank ────────────────────────────────────────────────────────────────
  await db.delete(bloodBankTable);
  await db.insert(bloodBankTable).values([
    { bloodType: "A+",  totalBags: 30, availableBags: 22, urgentRequests: 1, expiringSoon: 3 },
    { bloodType: "A-",  totalBags: 10, availableBags: 7,  urgentRequests: 0, expiringSoon: 1 },
    { bloodType: "B+",  totalBags: 25, availableBags: 18, urgentRequests: 2, expiringSoon: 2 },
    { bloodType: "B-",  totalBags: 8,  availableBags: 5,  urgentRequests: 1, expiringSoon: 0 },
    { bloodType: "AB+", totalBags: 15, availableBags: 10, urgentRequests: 2, expiringSoon: 3 },
    { bloodType: "AB-", totalBags: 5,  availableBags: 3,  urgentRequests: 1, expiringSoon: 0 },
    { bloodType: "O+",  totalBags: 40, availableBags: 28, urgentRequests: 1, expiringSoon: 2 },
    { bloodType: "O-",  totalBags: 23, availableBags: 7,  urgentRequests: 0, expiringSoon: 1 },
  ]);
  console.log("✅ Blood bank seeded (8 blood types)");

  // ── Vehicles ──────────────────────────────────────────────────────────────────
  await db.delete(vehiclesTable);
  await db.insert(vehiclesTable).values([
    { registration: "AMB-001", type: "ambulance", status: "in_service" },
    { registration: "AMB-002", type: "ambulance", status: "available" },
    { registration: "AMB-003", type: "ambulance", status: "in_service" },
    { registration: "AMB-004", type: "ambulance", status: "available" },
    { registration: "AMB-005", type: "ambulance", status: "in_service" },
    { registration: "AMB-006", type: "ambulance", status: "available" },
    { registration: "AMB-007", type: "ambulance", status: "in_service" },
    { registration: "AMB-008", type: "ambulance", status: "available" },
    { registration: "AMB-009", type: "ambulance", status: "in_service" },
    { registration: "AMB-010", type: "ambulance", status: "in_service" },
    { registration: "AMB-011", type: "ambulance", status: "maintenance" },
    { registration: "AMB-012", type: "ambulance", status: "maintenance" },
  ]);
  console.log("✅ Vehicles seeded (12)");

  await pool.end();
  console.log("🎉 Seed complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
