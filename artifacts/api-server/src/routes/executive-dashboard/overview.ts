import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();

/** Helper: build a date-range WHERE clause fragment */
function periodRange(period: string, from?: string, to?: string): { start: Date; end: Date } {
  if (from && to) return { start: new Date(from), end: new Date(to) };
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  switch (period) {
    case 'week':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      break;
    case 'month':
      start.setDate(1); start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      break;
    case 'quarter':
      start.setMonth(Math.floor(now.getMonth()/3)*3, 1); start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      break;
    case 'year':
      start.setMonth(0,1); start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      break;
    default: // day
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
  }
  return { start, end };
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// GET /api/executive-dashboard/overview
router.get('/', requirePermission('executive.view'), async (req, res) => {
  const { period = 'day', from, to, site_id } = req.query as Record<string,string>;
  const { start, end } = periodRange(period, from, to);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  const siteFilter = site_id ? `AND site_id = '${site_id}'` : '';

  const results = await Promise.allSettled([
    // 0: total patients
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM patients WHERE deleted_at IS NULL ${siteFilter}`), [{ c: '0' }]),
    // 1: new patients today
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM patients WHERE deleted_at IS NULL AND created_at >= $1 AND created_at <= $2 ${siteFilter}`, [today, todayEnd]), [{ c: '0' }]),
    // 2: admissions in period
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM admissions WHERE deleted_at IS NULL AND admission_date >= $1 AND admission_date <= $2 ${siteFilter}`, [start, end]), [{ c: '0' }]),
    // 3: discharges in period
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM admissions WHERE deleted_at IS NULL AND actual_discharge_date >= $1 AND actual_discharge_date <= $2 ${siteFilter}`, [start, end]), [{ c: '0' }]),
    // 4: bed occupancy
    safeQuery(() => db.query(`SELECT COUNT(*) FILTER (WHERE status='occupied') as occupied, COUNT(*) FILTER (WHERE status='available') as available, COUNT(*) as total FROM occupancy_beds WHERE deleted_at IS NULL ${siteFilter}`), [{ occupied:'0', available:'0', total:'0' }]),
    // 5: urgences en attente
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM emergency_visits WHERE deleted_at IS NULL AND status NOT IN ('discharged','admitted','transferred','left_without_being_seen') ${siteFilter}`), [{ c: '0' }]),
    // 6: avg wait minutes urgences (today)
    safeQuery(() => db.query(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-created_at))/60),0) as avg FROM emergency_visits WHERE deleted_at IS NULL AND created_at >= $1 AND status NOT IN ('discharged','admitted','transferred','left_without_being_seen') ${siteFilter}`, [today]), [{ avg: null }]),
    // 7: consultations in period
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM consultations WHERE deleted_at IS NULL AND scheduled_at >= $1 AND scheduled_at <= $2 ${siteFilter}`, [start, end]), [{ c: '0' }]),
    // 8: lab orders in period
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM lab_orders WHERE ordered_at >= $1 AND ordered_at <= $2`, [start, end]), [{ c: '0' }]),
    // 9: imaging orders in period
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM imaging_orders WHERE ordered_at >= $1 AND ordered_at <= $2`, [start, end]), [{ c: '0' }]),
    // 10: bloc interventions in period
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM surgical_requests WHERE deleted_at IS NULL AND created_at >= $1 AND created_at <= $2`, [start, end]), [{ c: '0' }]),
    // 11: CA today
    safeQuery(() => db.query(`SELECT COALESCE(SUM(total_amount),0) as s FROM invoices WHERE deleted_at IS NULL AND invoice_date >= $1 AND invoice_date <= $2 ${siteFilter}`, [today, todayEnd]), [{ s: '0' }]),
    // 12: CA month
    safeQuery(() => db.query(`SELECT COALESCE(SUM(total_amount),0) as s FROM invoices WHERE deleted_at IS NULL AND DATE_TRUNC('month',invoice_date) = DATE_TRUNC('month',NOW()) ${siteFilter}`), [{ s: '0' }]),
    // 13: encaissé today
    safeQuery(() => db.query(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE paid_at >= $1 AND paid_at <= $2`, [today, todayEnd]), [{ s: '0' }]),
    // 14: reste à recouvrer
    safeQuery(() => db.query(`SELECT COALESCE(SUM(remaining_amount),0) as s FROM invoices WHERE deleted_at IS NULL AND status NOT IN ('paid','cancelled') ${siteFilter}`), [{ s: '0' }]),
    // 15: créances assurance
    safeQuery(() => db.query(`SELECT COALESCE(SUM(insurer_share),0) as s FROM invoices WHERE deleted_at IS NULL AND insurance_type IS NOT NULL AND status NOT IN ('paid','cancelled') ${siteFilter}`), [{ s: '0' }]),
    // 16: stock critique
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM medical_items WHERE is_active=true AND deleted_at IS NULL AND quantity_on_hand <= reorder_point`), [{ c: '0' }]),
    // 17: lots expirant 30j
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM medical_batches WHERE expiry_date <= NOW()+INTERVAL '30 days' AND expiry_date > NOW() AND quantity_on_hand > 0 AND deleted_at IS NULL`), [{ c: '0' }]),
    // 18: équipements en panne
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM biomedical_equipment WHERE status='out_of_service' AND deleted_at IS NULL`), [{ c: '0' }]),
    // 19: maintenances en retard
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM biomedical_equipment WHERE next_maintenance_date < NOW() AND status NOT IN ('decommissioned','out_of_service') AND deleted_at IS NULL`), [{ c: '0' }]),
    // 20: personnel présent today
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM attendance_records WHERE record_date=$1 AND status='present' AND deleted_at IS NULL`, [today.toISOString().split('T')[0]]), [{ c: '0' }]),
    // 21: personnel absent today
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM attendance_records WHERE record_date=$1 AND status='absent' AND deleted_at IS NULL`, [today.toISOString().split('T')[0]]), [{ c: '0' }]),
    // 22: retards today
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM attendance_records WHERE record_date=$1 AND late_minutes > 0 AND deleted_at IS NULL`, [today.toISOString().split('T')[0]]), [{ c: '0' }]),
    // 23: contrats expirant 30j
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM employee_contracts WHERE end_date <= NOW()+INTERVAL '30 days' AND end_date > NOW() AND status='active' AND deleted_at IS NULL`), [{ c: '0' }]),
    // 24: incidents qualité ouverts
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM quality_incidents WHERE status NOT IN ('clos','annule')`), [{ c: '0' }]),
    // 25: CAPA en retard
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM quality_corrective_actions WHERE due_date < NOW() AND status NOT IN ('efficace','inefficace','annule')`), [{ c: '0' }]),
    // 26: risques critiques
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM quality_risk_register WHERE criticality >= 15 AND status NOT IN ('accepte','archive')`), [{ c: '0' }]),
    // 27: ICU occupancy
    safeQuery(() => db.query(`SELECT COUNT(*) FILTER (WHERE status='active') as occupied, COUNT(*) as total FROM icu_patients WHERE deleted_at IS NULL`), [{ occupied: '0', total: '0' }]),
    // 28: insurance claims en attente
    safeQuery(() => db.query(`SELECT COUNT(*) as c FROM insurance_claims WHERE status NOT IN ('approved','rejected','paid') AND deleted_at IS NULL`), [{ c: '0' }]),
  ]);

  const val = (i: number, key = 'c') => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value[0]) return Number(r.value[0][key] ?? 0);
    return 0;
  };
  const beds = results[4].status === 'fulfilled' ? results[4].value[0] : { occupied:'0', available:'0', total:'0' };
  const icu  = results[27].status === 'fulfilled' ? results[27].value[0] : { occupied:'0', total:'0' };

  res.json({
    generatedAt: new Date().toISOString(),
    period: { type: period, start, end },
    patients:    { total: val(0), newToday: val(1) },
    admissions:  { period: val(2), discharges: val(3) },
    beds: {
      occupied:      Number(beds.occupied  ?? 0),
      available:     Number(beds.available ?? 0),
      total:         Number(beds.total     ?? 0),
      occupancyRate: Number(beds.total) > 0
        ? Math.round(100 * Number(beds.occupied) / Number(beds.total)) : 0,
    },
    icu: {
      occupied: Number(icu.occupied ?? 0),
      total:    Number(icu.total    ?? 0),
      rate:     Number(icu.total) > 0
        ? Math.round(100 * Number(icu.occupied) / Number(icu.total)) : 0,
    },
    urgences: { waiting: val(5), avgWaitMinutes: val(6, 'avg') },
    activity:  { consultations: val(7), lab: val(8), imaging: val(9), bloc: val(10) },
    finance: {
      caToday:          val(11, 's'),
      caMonth:          val(12, 's'),
      encaisse:         val(13, 's'),
      resteARecouvrer:  val(14, 's'),
      creancesAssurance:val(15, 's'),
      claimsEnAttente:  val(28),
    },
    stock:       { critique: val(16), expirant: val(17) },
    biomedical:  { enPanne: val(18), maintenancesEnRetard: val(19) },
    rh: {
      present:           val(20),
      absent:            val(21),
      retards:           val(22),
      contratsExpirant:  val(23),
    },
    qualite: {
      incidentsOuverts: val(24),
      capaEnRetard:     val(25),
      risquesCritiques: val(26),
    },
  });
});

export default router;
