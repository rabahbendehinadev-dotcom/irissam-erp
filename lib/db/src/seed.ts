/**
 * Seed script for IRISSAM Hospital ERP demo data.
 * Inserts in FK-dependency order: sites → users → patients → encounters → clinical records.
 * Run: pnpm --filter @workspace/db seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import {
  sitesTable,
  buildingsTable,
  floorsTable,
  departmentsTable,
  usersTable,
  patientsTable,
  encountersTable,
  emergencyRoomsTable,
  emergencyVisitsTable,
  ambulancesTable,
  occupancyBedsTable,
  icuBedsTable,
  admissionsTable,
  operatingRoomsTable,
  consultationsTable,
  appointmentsTable,
  labOrdersTable,
  imagingOrdersTable,
  prescriptionsTable,
  medicationsTable,
  bloodBankTable,
  alertsTable,
  vehiclesTable,
  bedsTable,
  dailyStatsTable,
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
const yestStr  = dateStr(1);

async function seed() {
  console.log("🌱 Seeding IRISSAM Hospital ERP database...");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 1: Infrastructure
  // ──────────────────────────────────────────────────────────────────────────

  // Site
  const [site] = await db.insert(sitesTable).values({
    name: "IRISSAM Hospital – Alger",
    code: "ALG-01",
    address: "Route de la clinique, Alger",
    city: "Alger",
    wilaya: "16",
    postalCode: "16000",
    phone: "+213 21 XX XX XX",
    email: "contact@irissam.dz",
    isActive: true,
  }).onConflictDoNothing().returning();

  const siteId = site?.id;
  if (!siteId) {
    console.log("⚠️  Site already exists, skipping infrastructure seed.");
  } else {
    const [building] = await db.insert(buildingsTable).values({
      siteId,
      name: "Bâtiment Principal",
      code: "BAT-A",
      floorsCount: 5,
    }).returning();

    const [floor0, floor1, floor2] = await db.insert(floorsTable).values([
      { buildingId: building.id, name: "Rez-de-chaussée", level: 0 },
      { buildingId: building.id, name: "1er étage",       level: 1 },
      { buildingId: building.id, name: "2ème étage",      level: 2 },
    ]).returning();

    const depts = await db.insert(departmentsTable).values([
      { siteId, buildingId: building.id, floorId: floor0.id, name: "Urgences",         code: "URG",   color: "#EF4444", capacity: 30 },
      { siteId, buildingId: building.id, floorId: floor1.id, name: "Médecine interne", code: "MED",   color: "#3B82F6", capacity: 80 },
      { siteId, buildingId: building.id, floorId: floor1.id, name: "Cardiologie",      code: "CAR",   color: "#EC4899", capacity: 35 },
      { siteId, buildingId: building.id, floorId: floor1.id, name: "Chirurgie",        code: "CHI",   color: "#F59E0B", capacity: 60 },
      { siteId, buildingId: building.id, floorId: floor2.id, name: "Pédiatrie",        code: "PED",   color: "#10B981", capacity: 50 },
      { siteId, buildingId: building.id, floorId: floor2.id, name: "Gynécologie",      code: "GYN",   color: "#8B5CF6", capacity: 40 },
      { siteId, buildingId: building.id, floorId: floor2.id, name: "Neurologie",       code: "NEU",   color: "#6366F1", capacity: 30 },
      { siteId, buildingId: building.id, floorId: floor2.id, name: "Orthopédie",       code: "ORT",   color: "#14B8A6", capacity: 30 },
      { siteId, buildingId: building.id, floorId: floor2.id, name: "Pneumologie",      code: "PNE",   color: "#F97316", capacity: 25 },
      { siteId, buildingId: building.id, floorId: floor0.id, name: "Réanimation",      code: "REA",   color: "#DC2626", capacity: 24 },
      { siteId, buildingId: building.id, floorId: floor1.id, name: "Endocrinologie",   code: "END",   color: "#0EA5E9", capacity: 16 },
    ]).returning();

    console.log(`✅ Infrastructure seeded (1 site, 1 building, 3 floors, ${depts.length} departments)`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 2: Users (Staff)
  // ──────────────────────────────────────────────────────────────────────────

  // Fetch the site back in case it already existed
  const sites = await db.select().from(sitesTable).limit(1);
  const seedSiteId = sites[0]?.id;

  await db.delete(usersTable);
  const users = await db.insert(usersTable).values([
    {
      firstName: "Admin",    lastName: "Système",   email: "admin@irissam.dz",
      role: "admin",         specialty: null,       status: "actif",
      hashedPassword: "$2b$12$placeholder_admin_hash",  // replace with real hash
      siteId: seedSiteId,
    },
    {
      firstName: "Karim",    lastName: "Martin",    email: "k.martin@irissam.dz",
      role: "doctor",        specialty: "Cardiologie", status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Sophie",   lastName: "Dubois",    email: "s.dubois@irissam.dz",
      role: "doctor",        specialty: "Gynécologie", status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Ahmed",    lastName: "Saadi",     email: "a.saadi@irissam.dz",
      role: "doctor",        specialty: "Urgences",    status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Marc",     lastName: "Dupont",    email: "m.dupont@irissam.dz",
      role: "doctor",        specialty: "Neurologie",  status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Fatou",    lastName: "Roux",      email: "f.roux@irissam.dz",
      role: "doctor",        specialty: "Orthopédie",  status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Leila",    lastName: "Bernard",   email: "l.bernard@irissam.dz",
      role: "doctor",        specialty: "Médecine interne", status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Sara",     lastName: "Moreau",    email: "s.moreau@irissam.dz",
      role: "doctor",        specialty: "Chirurgie",   status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Ibrahim",  lastName: "Kaci",      email: "i.kaci@irissam.dz",
      role: "doctor",        specialty: "Pneumologie", status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Nora",     lastName: "Leroy",     email: "n.leroy@irissam.dz",
      role: "doctor",        specialty: "Pédiatrie",   status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Amina",    lastName: "Chouiref",  email: "a.chouiref@irissam.dz",
      role: "doctor",        specialty: "Endocrinologie", status: "actif",
      hashedPassword: "$2b$12$placeholder_doctor_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Yasmine",  lastName: "Infirmière",email: "y.inf@irissam.dz",
      role: "nurse",         specialty: null,       status: "actif",
      hashedPassword: "$2b$12$placeholder_nurse_hash",
      siteId: seedSiteId,
    },
    {
      firstName: "Pharmacien", lastName: "Test",   email: "pharma@irissam.dz",
      role: "pharmacist",    specialty: null,       status: "actif",
      hashedPassword: "$2b$12$placeholder_pharma_hash",
      siteId: seedSiteId,
    },
  ]).returning();

  const [adminUser, drMartin, drDubois, drSaadi, drDupont, drRoux,
         drBernard, drMoreau, drKaci, drLeroy, drChouiref, nurseYasmine] = users;
  console.log(`✅ Users seeded (${users.length})`);

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 3: Patients (new UUID schema)
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(patientsTable);
  const patients = await db.insert(patientsTable).values([
    {
      mpiId: "MPI-2026-000001", fileNumber: "2026-1258", internalNumber: "INT-001",
      firstName: "Mohamed",   lastName: "Ali",       gender: "M", dateOfBirth: "1981-03-15",
      phone: "0555 12 34 56", bloodType: "B+",        rhesus: "+",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000002", fileNumber: "2026-1257", internalNumber: "INT-002",
      firstName: "Fatima",    lastName: "Zahra",     gender: "F", dateOfBirth: "1992-07-22",
      phone: "0555 23 45 67", bloodType: "A+",        rhesus: "+",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: ["Asthme"], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000003", fileNumber: "2026-1256", internalNumber: "INT-003",
      firstName: "Ahmed",     lastName: "Benali",    gender: "M", dateOfBirth: "1964-11-08",
      phone: "0555 34 56 78", bloodType: "O+",        rhesus: "+",
      status: "active",       syncStatus: "pending", isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: ["Pénicilline"],
      chronicDiseases: ["HTA", "Diabète T2"],         majorHistory: ["Pontage coronarien 2022"],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000004", fileNumber: "2026-1255", internalNumber: "INT-004",
      firstName: "Amina",     lastName: "Kherfi",    gender: "F", dateOfBirth: "1999-05-30",
      phone: "0555 45 67 89", bloodType: "A-",        rhesus: "-",
      status: "active",       syncStatus: "synced",  isIncomplete: true,  potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000005", fileNumber: "2026-1254", internalNumber: "INT-005",
      firstName: "Yacine",    lastName: "Hamdi",     gender: "M", dateOfBirth: "1988-09-12",
      phone: "0555 56 78 90", bloodType: "B-",        rhesus: "-",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000006", fileNumber: "2026-1253", internalNumber: "INT-006",
      firstName: "Rachid",    lastName: "Tlemcani",  gender: "M", dateOfBirth: "1974-02-20",
      phone: "0555 67 89 01", bloodType: "O-",        rhesus: "-",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: ["HTA"], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000007", fileNumber: "2026-1252", internalNumber: "INT-007",
      firstName: "Nadia",     lastName: "Boudjemaa", gender: "F", dateOfBirth: "1983-06-14",
      phone: "0555 78 90 12", bloodType: "AB+",       rhesus: "+",
      status: "active",       syncStatus: "pending", isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000008", fileNumber: "2026-1251", internalNumber: "INT-008",
      firstName: "Karim",     lastName: "Meziane",   gender: "M", dateOfBirth: "1998-12-03",
      phone: "0555 89 01 23", bloodType: null,        rhesus: null,
      status: "active",       syncStatus: "synced",  isIncomplete: true,  potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000009", fileNumber: "2026-1250", internalNumber: "INT-009",
      firstName: "Souad",     lastName: "Ferhat",    gender: "F", dateOfBirth: "1959-04-18",
      phone: "0555 90 12 34", bloodType: "A+",        rhesus: "+",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: ["Arythmie"], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000010", fileNumber: "2026-1249", internalNumber: "INT-010",
      firstName: "Omar",      lastName: "Hadjadj",   gender: "M", dateOfBirth: "2007-01-25",
      phone: "0555 01 23 45", bloodType: "O+",        rhesus: "+",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000011", fileNumber: "2026-1248", internalNumber: "INT-011",
      firstName: "Houria",    lastName: "Mansouri",  gender: "F", dateOfBirth: "1986-08-07",
      phone: "0555 12 34 00", bloodType: "B+",        rhesus: "+",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000012", fileNumber: "2026-1247", internalNumber: "INT-012",
      firstName: "Abdelkader", lastName: "Ziani",    gender: "M", dateOfBirth: "1952-10-30",
      phone: "0555 23 45 11", bloodType: "AB-",       rhesus: "-",
      status: "inactive",     syncStatus: "conflict", isIncomplete: false, potentialDuplicate: true,
      nationality: "DZ",      country: "DZ",
      allergies: [], chronicDiseases: ["HTA", "Insuffisance cardiaque"], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000013", fileNumber: "2026-1246", internalNumber: "INT-013",
      firstName: "Samira",    lastName: "Bouchama",  gender: "F", dateOfBirth: "1980-03-22",
      phone: "0555 34 56 22", bloodType: "A-",        rhesus: "-",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",
      allergies: [], chronicDiseases: ["Diabète T2"], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000014", fileNumber: "2026-1245", internalNumber: "INT-014",
      firstName: "Farid",     lastName: "Aissaoui",  gender: "M", dateOfBirth: "1969-07-11",
      phone: "0555 45 67 33", bloodType: "O+",        rhesus: "+",
      status: "active",       syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",
      allergies: [], chronicDiseases: ["BPCO"], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
    {
      mpiId: "MPI-2026-000015", fileNumber: "2026-1244", internalNumber: "INT-015",
      firstName: "Lynda",     lastName: "Chibane",   gender: "F", dateOfBirth: "1993-11-19",
      phone: "0555 56 78 44", bloodType: "B+",        rhesus: "+",
      status: "archived",     syncStatus: "synced",  isIncomplete: false, potentialDuplicate: false,
      nationality: "DZ",      country: "DZ",         allergies: [], chronicDiseases: [], majorHistory: [],
      siteId: seedSiteId,     createdBy: adminUser.id, updatedBy: adminUser.id,
    },
  ]).returning();

  const [ptAli, ptZahra, ptBenali, ptKherfi, ptHamdi, ptTlemcani,
         ptBoudjemaa, ptMeziane, ptFerhat, ptHadjadj, ptMansouri,
         ptZiani, ptBouchama, ptAissaoui, ptChibane] = patients;
  console.log(`✅ Patients seeded (${patients.length})`);

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 4: Emergency Rooms
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(emergencyRoomsTable);
  await db.insert(emergencyRoomsTable).values([
    { siteId: seedSiteId, name: "Salle de Triage",       shortName: "TRIAGE", type: "triage",       capacity: 4,  status: "libre"    },
    { siteId: seedSiteId, name: "Salle de Soins 1",      shortName: "SOINS1", type: "soins",        capacity: 6,  status: "occupee"  },
    { siteId: seedSiteId, name: "Salle de Soins 2",      shortName: "SOINS2", type: "soins",        capacity: 6,  status: "partielle"},
    { siteId: seedSiteId, name: "Réanimation urgences",  shortName: "REAAURG",type: "reanimation",  capacity: 4,  status: "occupee"  },
    { siteId: seedSiteId, name: "Salle d'Observation",   shortName: "OBS",    type: "observation",  capacity: 8,  status: "partielle"},
    { siteId: seedSiteId, name: "Salle d'Attente",       shortName: "WAIT",   type: "attente",      capacity: 20, status: "libre"    },
  ]);
  console.log("✅ Emergency rooms seeded (6)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 5: Ambulances
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(ambulancesTable);
  await db.insert(ambulancesTable).values([
    { siteId: seedSiteId, callSign: "AMB-001", type: "ambulance",      status: "disponible",      crewCount: 2 },
    { siteId: seedSiteId, callSign: "AMB-002", type: "ambulance",      status: "transport_patient",crewCount: 2,
      currentPatientName: "Patient X", currentPatientPriority: "P2", location: "En route HCA", etaMinutes: 8 },
    { siteId: seedSiteId, callSign: "AMB-003", type: "ambulance",      status: "vers_patient",    crewCount: 2, location: "Bir Mourad Raïs", etaMinutes: 12 },
    { siteId: seedSiteId, callSign: "AMB-004", type: "ambulance",      status: "disponible",      crewCount: 2 },
    { siteId: seedSiteId, callSign: "AMB-005", type: "ambulance",      status: "vers_hopital",    crewCount: 3, location: "Boulevard Mohamed V", etaMinutes: 5 },
    { siteId: seedSiteId, callSign: "AMB-006", type: "ambulance",      status: "disponible",      crewCount: 2 },
    { siteId: seedSiteId, callSign: "AMB-007", type: "ambulance_usic", status: "transport_patient",crewCount: 3, location: "Kouba", etaMinutes: 15 },
    { siteId: seedSiteId, callSign: "AMB-008", type: "ambulance",      status: "disponible",      crewCount: 2 },
    { siteId: seedSiteId, callSign: "AMB-009", type: "ambulance",      status: "sur_place",       crewCount: 2, location: "Bab El Oued", etaMinutes: 20 },
    { siteId: seedSiteId, callSign: "AMB-010", type: "ambulance",      status: "transport_patient",crewCount: 2, location: "En route", etaMinutes: 3 },
    { siteId: seedSiteId, callSign: "AMB-011", type: "ambulance",      status: "maintenance",     crewCount: 0 },
    { siteId: seedSiteId, callSign: "AMB-012", type: "ambulance",      status: "hors_service",    crewCount: 0 },
  ]);
  console.log("✅ Ambulances seeded (12)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 6: Operating Rooms (new UUID schema)
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(operatingRoomsTable);
  await db.insert(operatingRoomsTable).values([
    { siteId: seedSiteId, name: "Bloc opératoire 1", shortName: "BLOC-1", specialty: "Chirurgie générale",   status: "en_intervention" },
    { siteId: seedSiteId, name: "Bloc opératoire 2", shortName: "BLOC-2", specialty: "Chirurgie vasculaire", status: "en_preparation"  },
    { siteId: seedSiteId, name: "Bloc opératoire 3", shortName: "BLOC-3", specialty: "Orthopédie",           status: "libre"           },
    { siteId: seedSiteId, name: "Bloc opératoire 4", shortName: "BLOC-4", specialty: "Neurochirurgie",       status: "libre"           },
    { siteId: seedSiteId, name: "Bloc opératoire 5", shortName: "BLOC-5", specialty: "Cardiologie",          status: "en_intervention" },
    { siteId: seedSiteId, name: "Bloc opératoire 6", shortName: "BLOC-6", specialty: "Gynécologie",          status: "libre"           },
    { siteId: seedSiteId, name: "Bloc opératoire 7", shortName: "BLOC-7", specialty: "Urologie",             status: "libre"           },
    { siteId: seedSiteId, name: "Bloc opératoire 8", shortName: "BLOC-8", specialty: "Plastique",            status: "libre"           },
  ]);
  console.log("✅ Operating rooms seeded (8)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 7: ICU Beds
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(icuBedsTable);
  const icuBedRows = [];
  for (let i = 1; i <= 24; i++) {
    icuBedRows.push({
      number:   `REA-${i.toString().padStart(2, "0")}`,
      unitName: "Réanimation médicale",
      siteId:   seedSiteId!,
      type:     "icu" as const,
      status:   i <= 20 ? ("occupe" as const) : ("disponible" as const),
    });
  }
  await db.insert(icuBedsTable).values(icuBedRows);
  console.log("✅ ICU beds seeded (24)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 8: Encounters + Admissions + Ward Beds (simplified: 10 admissions)
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(encountersTable);
  await db.delete(admissionsTable);
  await db.delete(occupancyBedsTable);

  const admissionPatients = [
    { p: ptBenali,    doctor: drMartin,  service: "Cardiologie",      motif: "Insuffisance cardiaque décompensée", daysIn: 5 },
    { p: ptMansouri,  doctor: drDupont,  service: "Neurologie",       motif: "AVC ischémique – suivi post-aigu",   daysIn: 4 },
    { p: ptZiani,     doctor: drMartin,  service: "Cardiologie",      motif: "Cardiopathie ischémique",            daysIn: 3 },
    { p: ptBouchama,  doctor: drKaci,    service: "Pneumologie",      motif: "Pneumonie sévère",                   daysIn: 2 },
    { p: ptAissaoui,  doctor: drKaci,    service: "Pneumologie",      motif: "BPCO exacerbée",                     daysIn: 2 },
    { p: ptChibane,   doctor: drLeroy,   service: "Pédiatrie",        motif: "Gastro-entérite sévère",             daysIn: 1 },
    { p: ptHadjadj,   doctor: drRoux,    service: "Orthopédie",       motif: "Fracture col du fémur – opéré",      daysIn: 1 },
    { p: ptMeziane,   doctor: drSaadi,   service: "Urgences",         motif: "Douleurs abdominales aiguës",        daysIn: 0 },
    { p: ptFerhat,    doctor: drMartin,  service: "Cardiologie",      motif: "Fibrillation auriculaire",           daysIn: 0 },
    { p: ptTlemcani,  doctor: drBernard, service: "Médecine interne", motif: "Bilan polypathologie",               daysIn: 0 },
  ];

  let bedCounter = 101;
  for (const { p, doctor, service, motif, daysIn } of admissionPatients) {
    const [encounter] = await db.insert(encountersTable).values({
      patientId:      p.id,
      patientName:    `${p.firstName} ${p.lastName}`,
      type:           "admission",
      status:         "open",
      chiefComplaint: motif,
      sourceModule:   "admissions",
      primaryDoctorId:   doctor.id,
      primaryDoctorName: `Dr. ${doctor.lastName}`,
      siteId:         seedSiteId,
      openedAt:       daysAgo(daysIn, 8, 0),
      createdBy:      adminUser.id,
    }).returning();

    const admDate = dateStr(daysIn);
    const bedNumber = `${bedCounter++}`;

    const [bed] = await db.insert(occupancyBedsTable).values({
      number:      bedNumber,
      roomNumber:  `CH-${bedNumber}`,
      siteId:      seedSiteId!,
      type:        "standard",
      status:      "occupe",
      patientId:   p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      encounterId: encounter.id,
      occupiedAt:  daysAgo(daysIn, 8, 30),
      createdBy:   adminUser.id,
      updatedBy:   adminUser.id,
    }).returning();

    await db.insert(admissionsTable).values({
      admissionNumber:  `ADM-2026-${String(bedCounter - 100).padStart(4, "0")}`,
      encounterId:      encounter.id,
      patientId:        p.id,
      patientMpiId:     p.mpiId,
      patientName:      `${p.firstName} ${p.lastName}`,
      patientDob:       p.dateOfBirth,
      patientPhone:     p.phone,
      type:             "hospitalisation",
      status:           "active",
      priority:         "normal",
      serviceName:      service,
      doctorId:         doctor.id,
      doctorName:       `Dr. ${doctor.lastName}`,
      motif,
      bedId:            bed.id,
      bedNumber:        bed.number,
      admissionDate:    admDate,
      admissionTime:    "08:00",
      siteId:           seedSiteId,
      createdBy:        adminUser.id,
      updatedBy:        adminUser.id,
    });
  }
  console.log(`✅ Encounters + Admissions + Beds seeded (${admissionPatients.length} each)`);

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 9: Consultations (new UUID schema)
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(consultationsTable);
  await db.insert(consultationsTable).values([
    {
      number: "CON-2026-0001", patientId: ptMansouri.id,
      patientName: "Houria Mansouri", patientMpi: ptMansouri.mpiId,
      doctorId: drDupont.id, doctorName: `Dr. ${drDupont.lastName}`,
      specialty: "Neurologie", serviceName: "Neurologie",
      scheduledAt: today(8, 30), startedAt: today(8, 35), endedAt: today(9, 15),
      duration: 40, type: "consultation_externe", origin: "rdv",
      reason: "Céphalées chroniques, bilan neurologique", status: "terminee",
      siteId: seedSiteId, createdBy: adminUser.id,
    },
    {
      number: "CON-2026-0002", patientId: ptFerhat.id,
      patientName: "Souad Ferhat", patientMpi: ptFerhat.mpiId,
      doctorId: drMartin.id, doctorName: `Dr. ${drMartin.lastName}`,
      specialty: "Cardiologie", serviceName: "Cardiologie",
      scheduledAt: today(9, 0), startedAt: today(9, 5),
      duration: null, type: "consultation_externe", origin: "rdv",
      reason: "Bilan cardiologique annuel, contrôle HTA", status: "en_cours",
      siteId: seedSiteId, createdBy: adminUser.id,
    },
    {
      number: "CON-2026-0003", patientId: ptZahra.id,
      patientName: "Fatima Zahra", patientMpi: ptZahra.mpiId,
      doctorId: drDubois.id, doctorName: `Dr. ${drDubois.lastName}`,
      specialty: "Gynécologie", serviceName: "Gynécologie",
      scheduledAt: today(10, 30),
      duration: null, type: "consultation_externe", origin: "rdv",
      reason: "Suivi grossesse – 2ème trimestre", status: "en_attente",
      siteId: seedSiteId, createdBy: adminUser.id,
    },
    {
      number: "CON-2026-0004", patientId: ptAli.id,
      patientName: "Mohamed Ali", patientMpi: ptAli.mpiId,
      doctorId: drMartin.id, doctorName: `Dr. ${drMartin.lastName}`,
      specialty: "Cardiologie", serviceName: "Cardiologie",
      scheduledAt: today(11, 0),
      duration: null, type: "consultation_externe", origin: "rdv",
      reason: "Contrôle post-opératoire – pontage coronarien", status: "planifiee",
      siteId: seedSiteId, createdBy: adminUser.id,
    },
    {
      number: "CON-2026-0005", patientId: ptMeziane.id,
      patientName: "Karim Meziane", patientMpi: ptMeziane.mpiId,
      doctorId: drSaadi.id, doctorName: `Dr. ${drSaadi.lastName}`,
      specialty: "Urgences", serviceName: "Urgences",
      scheduledAt: today(7, 45), startedAt: today(7, 50), endedAt: today(8, 20),
      duration: 30, type: "urgence", origin: "urgence",
      reason: "Douleurs abdominales aiguës", status: "terminee",
      siteId: seedSiteId, createdBy: adminUser.id,
    },
    {
      number: "CON-2026-0006", patientId: ptBenali.id,
      patientName: "Ahmed Benali", patientMpi: ptBenali.mpiId,
      doctorId: drMartin.id, doctorName: `Dr. ${drMartin.lastName}`,
      specialty: "Cardiologie", serviceName: "Cardiologie",
      scheduledAt: daysAgo(1, 9, 0), startedAt: daysAgo(1, 9, 5), endedAt: daysAgo(1, 9, 35),
      duration: 30, type: "consultation_externe", origin: "rdv",
      reason: "Palpitations, bilan ECG", status: "terminee",
      siteId: seedSiteId, createdBy: adminUser.id,
    },
  ]);
  console.log("✅ Consultations seeded (6)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 10: Appointments (new UUID schema)
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(appointmentsTable);
  await db.insert(appointmentsTable).values([
    { patientId: ptZahra.id,      patientName: "Fatima Zahra",     doctorId: drDubois.id,  doctorName: `Dr. ${drDubois.lastName}`,  departmentName: "Gynécologie",      scheduledAt: today(10, 30), duration: 30, status: "confirmed", siteId: seedSiteId },
    { patientId: ptAli.id,        patientName: "Mohamed Ali",      doctorId: drMartin.id,  doctorName: `Dr. ${drMartin.lastName}`,  departmentName: "Cardiologie",      scheduledAt: today(11, 0),  duration: 45, status: "confirmed", notes: "Contrôle post-opératoire", siteId: seedSiteId },
    { patientId: ptKherfi.id,     patientName: "Amina Kherfi",     doctorId: drLeroy.id,   doctorName: `Dr. ${drLeroy.lastName}`,   departmentName: "Pédiatrie",        scheduledAt: today(11, 30), duration: 20, status: "pending",   siteId: seedSiteId },
    { patientId: ptHamdi.id,      patientName: "Yacine Hamdi",     doctorId: drMoreau.id,  doctorName: `Dr. ${drMoreau.lastName}`,  departmentName: "Chirurgie",        scheduledAt: today(14, 0),  duration: 60, status: "confirmed", notes: "Consultation pré-opératoire", siteId: seedSiteId },
    { patientId: ptTlemcani.id,   patientName: "Rachid Tlemcani",  doctorId: drBernard.id, doctorName: `Dr. ${drBernard.lastName}`, departmentName: "Médecine interne", scheduledAt: today(15, 30), duration: 30, status: "pending",   siteId: seedSiteId },
    { patientId: ptBoudjemaa.id,  patientName: "Nadia Boudjemaa",  doctorId: drDubois.id,  doctorName: `Dr. ${drDubois.lastName}`,  departmentName: "Gynécologie",      scheduledAt: today(16, 0),  duration: 30, status: "confirmed", siteId: seedSiteId },
    { patientId: ptFerhat.id,     patientName: "Souad Ferhat",     doctorId: drMartin.id,  doctorName: `Dr. ${drMartin.lastName}`,  departmentName: "Cardiologie",      scheduledAt: today(9, 0),   duration: 45, status: "confirmed", notes: "Bilan cardiologique annuel", siteId: seedSiteId },
    { patientId: ptMansouri.id,   patientName: "Houria Mansouri",  doctorId: drDupont.id,  doctorName: `Dr. ${drDupont.lastName}`,  departmentName: "Neurologie",       scheduledAt: today(8, 30),  duration: 40, status: "completed", siteId: seedSiteId },
    { patientId: ptBenali.id,     patientName: "Ahmed Benali",     doctorId: drMartin.id,  doctorName: `Dr. ${drMartin.lastName}`,  departmentName: "Cardiologie",      scheduledAt: daysAgo(1, 9, 0), duration: 30, status: "completed", siteId: seedSiteId },
    { patientId: ptMeziane.id,    patientName: "Karim Meziane",    doctorId: drSaadi.id,   doctorName: `Dr. ${drSaadi.lastName}`,   departmentName: "Urgences",         scheduledAt: daysAgo(1, 14, 30), duration: 20, status: "cancelled", cancelledReason: "Patient absent", siteId: seedSiteId },
    { patientId: ptHadjadj.id,    patientName: "Omar Hadjadj",     doctorId: drRoux.id,    doctorName: `Dr. ${drRoux.lastName}`,    departmentName: "Orthopédie",       scheduledAt: daysAgo(2, 10, 0), duration: 30, status: "completed", siteId: seedSiteId },
    { patientId: ptBouchama.id,   patientName: "Samira Bouchama",  doctorId: drChouiref.id,doctorName: `Dr. ${drChouiref.lastName}`,departmentName: "Endocrinologie",   scheduledAt: daysAgo(2, 11, 30), duration: 30, status: "no_show", siteId: seedSiteId },
  ]);
  console.log("✅ Appointments seeded (12)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 11: Medications (new UUID schema)
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(medicationsTable);
  await db.insert(medicationsTable).values([
    { name: "Paracétamol 1G",           category: "antalgique",    form: "comprimé", unit: "boîtes", quantity: 15,  lowStockThreshold: 50,  expiryDate: "2027-03-01", siteId: seedSiteId },
    { name: "Amoxicilline 500mg",        category: "antibiotique",  form: "gélule",   unit: "boîtes", quantity: 20,  lowStockThreshold: 30,  expiryDate: "2026-08-20", siteId: seedSiteId },
    { name: "Sérum physiologique 250ml", category: "perfusion",     form: "poche",    unit: "poches", quantity: 18,  lowStockThreshold: 40,  expiryDate: "2026-12-01", siteId: seedSiteId },
    { name: "Ibuprofène 400mg",          category: "anti-inflammatoire", form: "comprimé", unit: "boîtes", quantity: 120, lowStockThreshold: 50,  expiryDate: "2027-06-01", siteId: seedSiteId },
    { name: "Metformine 850mg",          category: "antidiabétique",form: "comprimé", unit: "boîtes", quantity: 85,  lowStockThreshold: 30,  expiryDate: "2027-01-01", siteId: seedSiteId },
    { name: "Oméprazole 20mg",           category: "gastro",        form: "gélule",   unit: "boîtes", quantity: 200, lowStockThreshold: 50,  expiryDate: "2027-09-01", siteId: seedSiteId },
    { name: "Amlodipine 5mg",            category: "antihypertenseur", form: "comprimé", unit: "boîtes", quantity: 75, lowStockThreshold: 30, expiryDate: "2027-04-01", siteId: seedSiteId },
    { name: "Héparine 5000 UI/mL",       category: "anticoagulant", form: "ampoule",  unit: "ampoules", quantity: 45, lowStockThreshold: 20, expiryDate: "2026-11-01", siteId: seedSiteId },
    { name: "Lidocaïne 2%",              category: "anesthésique",  form: "ampoule",  unit: "ampoules", quantity: 80, lowStockThreshold: 30, expiryDate: "2027-02-01", siteId: seedSiteId },
    { name: "Morphine 10mg",             category: "antalgique",    form: "ampoule",  unit: "ampoules", quantity: 12, lowStockThreshold: 10, expiryDate: "2026-09-01", siteId: seedSiteId },
  ]);
  console.log("✅ Medications seeded (10)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 12: Blood Bank (new UUID schema — site-based)
  // ──────────────────────────────────────────────────────────────────────────

  if (seedSiteId) {
    await db.delete(bloodBankTable);
    await db.insert(bloodBankTable).values([
      { siteId: seedSiteId, bloodType: "A+",  rhesus: "+", unitsAvailable: 22, unitsReserved: 2  },
      { siteId: seedSiteId, bloodType: "A-",  rhesus: "-", unitsAvailable:  7, unitsReserved: 0  },
      { siteId: seedSiteId, bloodType: "B+",  rhesus: "+", unitsAvailable: 18, unitsReserved: 3  },
      { siteId: seedSiteId, bloodType: "B-",  rhesus: "-", unitsAvailable:  5, unitsReserved: 1  },
      { siteId: seedSiteId, bloodType: "AB+", rhesus: "+", unitsAvailable: 10, unitsReserved: 2  },
      { siteId: seedSiteId, bloodType: "AB-", rhesus: "-", unitsAvailable:  3, unitsReserved: 1  },
      { siteId: seedSiteId, bloodType: "O+",  rhesus: "+", unitsAvailable: 28, unitsReserved: 2  },
      { siteId: seedSiteId, bloodType: "O-",  rhesus: "-", unitsAvailable:  7, unitsReserved: 0  },
    ]);
    console.log("✅ Blood bank seeded (8 groups)");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 13: Alerts (new UUID schema)
  // ──────────────────────────────────────────────────────────────────────────

  await db.delete(alertsTable);
  await db.insert(alertsTable).values([
    { siteId: seedSiteId, type: "critical", severity: "critical", title: "Résultat d'analyse critique",      message: "Patient : Fatima Zahra – Potassium élevé (6.8 mmol/L)", isRead: false, module: "laboratoire", createdAt: today(10, 15) },
    { siteId: seedSiteId, type: "warning",  severity: "warning",  title: "Stock critique – Paracétamol 1G", message: "Pharmacie : 15 unités restantes (seuil minimum : 50)",   isRead: false, module: "pharmacie",    createdAt: today(9, 45)  },
    { siteId: seedSiteId, type: "warning",  severity: "warning",  title: "Médicament proche péremption",    message: "Amoxicilline 500mg expire le 20/08/2026",               isRead: false, module: "pharmacie",    createdAt: today(9, 30)  },
    { siteId: seedSiteId, type: "critical", severity: "critical", title: "Réanimation saturée",             message: "Capacité 100% – 24/24 lits occupés",                    isRead: false, module: "hospitalisation", createdAt: today(9, 20) },
    { siteId: seedSiteId, type: "info",     severity: "info",     title: "Intervention chirurgicale en retard", message: "Bloc 2 – Retard estimé 45 min",                    isRead: false, module: "bloc",         createdAt: today(9, 10)  },
    { siteId: seedSiteId, type: "warning",  severity: "warning",  title: "Défaillance équipement – ECG",    message: "Électrocardiographe du Bloc C hors service",            isRead: true,  module: "bloc",         createdAt: daysAgo(0, 8, 0) },
    { siteId: seedSiteId, type: "warning",  severity: "warning",  title: "Stock faible – Sérum physiologique", message: "18 poches restantes (seuil : 40)",                 isRead: true,  module: "pharmacie",    createdAt: daysAgo(0, 7, 30) },
    { siteId: seedSiteId, type: "info",     severity: "info",     title: "Résultats d'imagerie disponibles", message: "Patient Ahmed Benali – Scanner thoracique",           isRead: true,  module: "imagerie",     createdAt: daysAgo(1, 11, 0) },
  ]);
  console.log("✅ Alerts seeded (8)");

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 14: Legacy dashboard tables (unchanged column shapes)
  // beds, vehicles, daily_stats — used by /api/beds, /api/vehicles, /api/daily-stats
  // until Task #71 migrates those routes to the new tables.
  // ──────────────────────────────────────────────────────────────────────────

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
  console.log("✅ Legacy bed stats seeded (11 services)");

  await db.delete(vehiclesTable);
  await db.insert(vehiclesTable).values([
    { registration: "AMB-001", type: "ambulance", status: "available" },
    { registration: "AMB-002", type: "ambulance", status: "in_service" },
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
  console.log("✅ Legacy vehicles seeded (12)");

  await db.delete(dailyStatsTable);
  await db.insert(dailyStatsTable).values([
    { statDate: dateStr(6), totalPatients: 440, newAdmissions: 18, discharges: 12, emergencyVisits: 62, consultations: 340, surgeries: 6, icuOccupancy: 22, bedOccupancyRate: 78 },
    { statDate: dateStr(5), totalPatients: 448, newAdmissions: 20, discharges: 15, emergencyVisits: 70, consultations: 380, surgeries: 7, icuOccupancy: 21, bedOccupancyRate: 80 },
    { statDate: dateStr(4), totalPatients: 455, newAdmissions: 22, discharges: 18, emergencyVisits: 75, consultations: 420, surgeries: 8, icuOccupancy: 23, bedOccupancyRate: 82 },
    { statDate: dateStr(3), totalPatients: 450, newAdmissions: 19, discharges: 14, emergencyVisits: 68, consultations: 350, surgeries: 6, icuOccupancy: 22, bedOccupancyRate: 81 },
    { statDate: dateStr(2), totalPatients: 460, newAdmissions: 23, discharges: 17, emergencyVisits: 80, consultations: 430, surgeries: 9, icuOccupancy: 24, bedOccupancyRate: 84 },
    { statDate: dateStr(1), totalPatients: 465, newAdmissions: 21, discharges: 16, emergencyVisits: 85, consultations: 460, surgeries: 8, icuOccupancy: 23, bedOccupancyRate: 83 },
    { statDate: dateStr(0), totalPatients: 462, newAdmissions: 10, discharges:  9, emergencyVisits: 45, consultations: 312, surgeries: 4, icuOccupancy: 20, bedOccupancyRate: 82 },
  ]);
  console.log("✅ Legacy daily stats seeded (7 days)");

  await pool.end();
  console.log("🎉 Seed complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
