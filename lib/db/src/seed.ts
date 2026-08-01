/**
 * Seed script for IRISSAM Hospital ERP demo data.
 * Run: npx tsx src/seed.ts
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

async function seed() {
  console.log("🌱 Seeding database...");

  // ── Patients ────────────────────────────────────────────────────────────────
  await db.delete(patientsTable);
  await db.insert(patientsTable).values([
    { name: "Mohamed Ali", age: 45, fileNumber: "2026-1258", service: "Médecine interne", registeredAt: daysAgo(0, 10, 10) },
    { name: "Fatima Zahra", age: 32, fileNumber: "2026-1257", service: "Gynécologie", registeredAt: daysAgo(0, 10, 5) },
    { name: "Ahmed Benali", age: 60, fileNumber: "2026-1256", service: "Cardiologie", registeredAt: daysAgo(0, 9, 58) },
    { name: "Amina Kherfi", age: 27, fileNumber: "2026-1255", service: "Pédiatrie", registeredAt: daysAgo(0, 9, 50) },
    { name: "Yacine Hamdi", age: 36, fileNumber: "2026-1254", service: "Chirurgie", registeredAt: daysAgo(0, 9, 45) },
    { name: "Rachid Tlemcani", age: 52, fileNumber: "2026-1253", service: "Médecine interne", registeredAt: daysAgo(1, 14, 30) },
    { name: "Nadia Boudjemaa", age: 41, fileNumber: "2026-1252", service: "Gynécologie", registeredAt: daysAgo(1, 11, 20) },
    { name: "Karim Meziane", age: 28, fileNumber: "2026-1251", service: "Urgences", registeredAt: daysAgo(1, 8, 15) },
    { name: "Souad Ferhat", age: 65, fileNumber: "2026-1250", service: "Cardiologie", registeredAt: daysAgo(2, 16, 0) },
    { name: "Omar Hadjadj", age: 19, fileNumber: "2026-1249", service: "Orthopédie", registeredAt: daysAgo(2, 9, 0) },
    { name: "Houria Mansouri", age: 38, fileNumber: "2026-1248", service: "Neurologie", registeredAt: daysAgo(3, 10, 0) },
    { name: "Abdelkader Ziani", age: 72, fileNumber: "2026-1247", service: "Cardiologie", registeredAt: daysAgo(3, 8, 30) },
    { name: "Samira Bouchama", age: 44, fileNumber: "2026-1246", service: "Endocrinologie", registeredAt: daysAgo(4, 11, 0) },
    { name: "Farid Aissaoui", age: 55, fileNumber: "2026-1245", service: "Pneumologie", registeredAt: daysAgo(4, 9, 30) },
    { name: "Lynda Chibane", age: 31, fileNumber: "2026-1244", service: "Pédiatrie", registeredAt: daysAgo(5, 10, 0) },
  ]);
  console.log("✅ Patients seeded (15)");

  // ── Appointments (today) ─────────────────────────────────────────────────
  await db.delete(appointmentsTable);
  await db.insert(appointmentsTable).values([
    { patientName: "Fatima Zahra",      service: "Gynécologie",       doctorName: "Dr. Dubois",   scheduledAt: today(10, 30), status: "confirmed" },
    { patientName: "Mohamed Ali",       service: "Cardiologie",       doctorName: "Dr. Martin",   scheduledAt: today(11, 0),  status: "confirmed" },
    { patientName: "Amina Kherfi",      service: "Pédiatrie",         doctorName: "Dr. Leroy",    scheduledAt: today(11, 30), status: "pending" },
    { patientName: "Yacine Hamdi",      service: "Chirurgie",         doctorName: "Dr. Moreau",   scheduledAt: today(14, 0),  status: "confirmed" },
    { patientName: "Rachid Tlemcani",   service: "Médecine interne",  doctorName: "Dr. Bernard",  scheduledAt: today(15, 30), status: "pending" },
    { patientName: "Nadia Boudjemaa",   service: "Gynécologie",       doctorName: "Dr. Dubois",   scheduledAt: today(16, 0),  status: "confirmed" },
    { patientName: "Souad Ferhat",      service: "Cardiologie",       doctorName: "Dr. Martin",   scheduledAt: today(9, 0),   status: "confirmed" },
    { patientName: "Houria Mansouri",   service: "Neurologie",        doctorName: "Dr. Dupont",   scheduledAt: today(8, 30),  status: "confirmed" },
  ]);
  console.log("✅ Appointments seeded (8)");

  // ── Alerts ──────────────────────────────────────────────────────────────
  await db.delete(alertsTable);
  await db.insert(alertsTable).values([
    {
      type: "critical",
      title: "Résultat d'analyse critique",
      detail: "Patient : Fatima Zahra – Potassium élevé (6.8 mmol/L)",
      isActive: true,
      createdAt: today(10, 15),
    },
    {
      type: "warning",
      title: "Stock faible – Paracétamol 1G",
      detail: "Pharmacie : 15 unités restantes (seuil minimum : 50)",
      isActive: true,
      createdAt: today(9, 45),
    },
    {
      type: "warning",
      title: "Médicament proche péremption",
      detail: "Amoxicilline 500mg – Expire le 20/08/2026",
      isActive: true,
      createdAt: today(9, 30),
    },
    {
      type: "critical",
      title: "Service de réanimation indisponible",
      detail: "Service Réanimation – Capacité 100% (24/24 lits occupés)",
      isActive: true,
      createdAt: today(9, 20),
    },
    {
      type: "info",
      title: "Intervention chirurgicale en retard",
      detail: "Bloc 2 – Début prévu à 09:00 – Retard estimé 45 min",
      isActive: true,
      createdAt: today(9, 10),
    },
  ]);
  console.log("✅ Alerts seeded (5)");

  // ── Admissions (mix: current + discharged) ────────────────────────────
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
    // Still admitted (hospitalized)
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
    // Discharged
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

  // ── Medications ─────────────────────────────────────────────────────────
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

  // ── Daily Stats (last 7 days) ─────────────────────────────────────────
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

  // ── Beds (by service) ────────────────────────────────────────────────────
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

  // ── Operating Rooms ──────────────────────────────────────────────────────
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

  // ── Blood Bank ───────────────────────────────────────────────────────────
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

  // ── Vehicles ─────────────────────────────────────────────────────────────
  await db.delete(vehiclesTable);
  await db.insert(vehiclesTable).values([
    { registration: "AMB-001", type: "ambulance",         status: "in_service" },
    { registration: "AMB-002", type: "ambulance",         status: "available" },
    { registration: "AMB-003", type: "ambulance",         status: "in_service" },
    { registration: "AMB-004", type: "ambulance",         status: "available" },
    { registration: "AMB-005", type: "ambulance",         status: "in_service" },
    { registration: "AMB-006", type: "ambulance",         status: "available" },
    { registration: "AMB-007", type: "ambulance",         status: "in_service" },
    { registration: "AMB-008", type: "ambulance",         status: "available" },
    { registration: "AMB-009", type: "ambulance",         status: "in_service" },
    { registration: "AMB-010", type: "ambulance",         status: "in_service" },
    { registration: "AMB-011", type: "ambulance",         status: "maintenance" },
    { registration: "AMB-012", type: "ambulance",         status: "maintenance" },
  ]);
  console.log("✅ Vehicles seeded (12)");

  await pool.end();
  console.log("🎉 Seed complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
