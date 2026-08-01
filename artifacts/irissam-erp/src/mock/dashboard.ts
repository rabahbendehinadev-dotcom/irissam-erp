export const MOCK_DASHBOARD_STATS = {
  totalPatients: 12458,
  totalPatientsTrend: 12.5,
  appointmentsToday: 266,
  appointmentsTodayTrend: 8.3,
  hospitalizedPatients: 183,
  hospitalizedPatientsTrend: 4.2,
  admissionsToday: 24,
  admissionsTodayTrend: 20,
  emergenciesWaiting: 18,
  emergenciesWaitingTrend: -10,
  consultationsToday: 312,
  consultationsTodayTrend: 15,
  analysesToday: 145,
  analysesTodayTrend: 22,
  imagingToday: 68,
  imagingTodayTrend: 18,
  invoicesToday: 156,
  invoicesTodayTrend: 16,
  revenueToday: 2145000,
  revenueTodayTrend: 14.8,
  bedOccupancyRate: 78,
  bedOccupancyTrend: 5,
};

export const MOCK_CHART_CONSULTATIONS = [
  { date: '08 Mai', consultations: 340, appointments: 180 },
  { date: '09 Mai', consultations: 380, appointments: 200 },
  { date: '10 Mai', consultations: 420, appointments: 230 },
  { date: '11 Mai', consultations: 350, appointments: 190 },
  { date: '12 Mai', consultations: 430, appointments: 250 },
  { date: '13 Mai', consultations: 460, appointments: 280 },
  { date: '14 Mai', consultations: 312, appointments: 266 },
];

export const MOCK_CHART_ADMISSIONS = [
  { date: '08 Mai', admissions: 18, discharges: 15 },
  { date: '09 Mai', admissions: 25, discharges: 20 },
  { date: '10 Mai', admissions: 22, discharges: 18 },
  { date: '11 Mai', admissions: 30, discharges: 25 },
  { date: '12 Mai', admissions: 28, discharges: 22 },
  { date: '13 Mai', admissions: 24, discharges: 19 },
  { date: '14 Mai', admissions: 20, discharges: 17 },
];

export const MOCK_CHART_SERVICES = [
  { name: 'Médecine interne', value: 347, percentage: 28, color: '#3B82F6' },
  { name: 'Chirurgie', value: 248, percentage: 20, color: '#06B6D4' },
  { name: 'Pédiatrie', value: 186, percentage: 15, color: '#10B981' },
  { name: 'Gynécologie', value: 149, percentage: 12, color: '#8B5CF6' },
  { name: 'Cardiologie', value: 124, percentage: 10, color: '#F97316' },
  { name: 'Urgences', value: 99, percentage: 8, color: '#EF4444' },
  { name: 'Autres', value: 88, percentage: 7, color: '#94A3B8' },
];

export const MOCK_BED_OCCUPANCY = {
  total: 420,
  occupied: 312,
  available: 88,
  cleaning: 15,
  outOfService: 5,
  rate: 78,
};
