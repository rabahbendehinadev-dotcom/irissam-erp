import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/alerts
router.get('/', requirePermission('executive.view'), async (req, res) => {
  const { site_id } = req.query as Record<string,string>;
  const sf = site_id ? `AND site_id='${site_id}'` : '';
  const today = new Date(); today.setHours(0,0,0,0);

  const checks = await Promise.allSettled([
    // 0: bed occupancy > 90%
    safe(() => db.query(`
      SELECT
        ROUND(100.0*COUNT(*) FILTER (WHERE status='occupied')/NULLIF(COUNT(*),0),1) as rate,
        COUNT(*) FILTER (WHERE status='occupied') as occupied,
        COUNT(*) as total
      FROM occupancy_beds WHERE deleted_at IS NULL ${sf}`, []), []),
    // 1: ICU full
    safe(() => db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='active') as occupied,
        COUNT(*) as total
      FROM icu_patients WHERE deleted_at IS NULL ${sf}`, []), []),
    // 2: critical stock ruptures
    safe(() => db.query(`
      SELECT COUNT(*) as c FROM medical_items
      WHERE is_active=true AND deleted_at IS NULL AND quantity_on_hand = 0`, []), []),
    // 3: vital equipment out of service
    safe(() => db.query(`
      SELECT COUNT(*) as c FROM biomedical_equipment
      WHERE status='out_of_service' AND criticality='critical' AND deleted_at IS NULL`, []), []),
    // 4: critical quality incident open
    safe(() => db.query(`
      SELECT COUNT(*) as c FROM quality_incidents
      WHERE severity='critique' AND status NOT IN ('clos','annule')`, []), []),
    // 5: overdue insurance claims > 30 days
    safe(() => db.query(`
      SELECT COUNT(*) as c FROM insurance_claims
      WHERE status NOT IN ('approved','rejected','paid')
        AND created_at < NOW()-INTERVAL '30 days' AND deleted_at IS NULL`, []), []),
    // 6: departments under-staffed today
    safe(() => db.query(`
      SELECT COUNT(*) as c FROM (
        SELECT e.department_id,
          COUNT(*) FILTER (WHERE ar.status='present')::float / NULLIF(COUNT(*),0) as rate
        FROM employees e
        LEFT JOIN attendance_records ar ON ar.employee_id=e.id AND ar.record_date=$1 AND ar.deleted_at IS NULL
        WHERE e.status='active' AND e.deleted_at IS NULL GROUP BY e.department_id
        HAVING COUNT(*) FILTER (WHERE ar.status='present')::float / NULLIF(COUNT(*),0) < 0.7
      ) x`, [today.toISOString().split('T')[0]]), []),
    // 7: today's revenue vs 30-day daily avg
    safe(() => db.query(`
      SELECT
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices
          WHERE deleted_at IS NULL AND invoice_date >= $1 ${sf}) as today_rev,
        (SELECT COALESCE(SUM(total_amount),0)/30.0 FROM invoices
          WHERE deleted_at IS NULL AND invoice_date >= NOW()-INTERVAL '30 days' ${sf}) as avg_daily
      `, [today]), []),
    // 8: high wait time urgences (avg > 60 min)
    safe(() => db.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-created_at))/60),0) as avg
      FROM emergency_visits WHERE deleted_at IS NULL
        AND status NOT IN ('discharged','admitted','transferred','left_without_being_seen')
        AND created_at >= $1 ${sf}`, [today]), []),
    // 9: CAPA very overdue (>14 days)
    safe(() => db.query(`
      SELECT COUNT(*) as c FROM quality_corrective_actions
      WHERE due_date < NOW()-INTERVAL '14 days'
        AND status NOT IN ('efficace','inefficace','annule')`, []), []),
  ]);

  const alerts: Array<{
    id: string; level: 'critical'|'warning'|'info';
    module: string; message: string;
    value?: number; threshold?: number;
    action: string; generatedAt: string;
  }> = [];

  const now = new Date().toISOString();

  // Check occupancy
  const occ = checks[0].status==='fulfilled' ? (checks[0].value as any[])[0] : null;
  if (occ && Number(occ.rate) >= 90) {
    alerts.push({ id:'occ-90', level:'critical', module:'Capacité',
      message:`Occupation lits: ${occ.rate}% (${occ.occupied}/${occ.total})`,
      value:Number(occ.rate), threshold:90,
      action:'Voir le tableau des capacités', generatedAt:now });
  } else if (occ && Number(occ.rate) >= 80) {
    alerts.push({ id:'occ-80', level:'warning', module:'Capacité',
      message:`Occupation lits: ${occ.rate}% — approche du seuil critique`,
      value:Number(occ.rate), threshold:80,
      action:'Voir le tableau des capacités', generatedAt:now });
  }

  // ICU full
  const icu = checks[1].status==='fulfilled' ? (checks[1].value as any[])[0] : null;
  if (icu && Number(icu.total) > 0 && Number(icu.occupied) >= Number(icu.total)) {
    alerts.push({ id:'icu-full', level:'critical', module:'Réanimation',
      message:`Réanimation complète: ${icu.occupied}/${icu.total} lits occupés`,
      action:'Voir réanimation', generatedAt:now });
  }

  // Stock ruptures
  const stockOut = checks[2].status==='fulfilled' ? Number((checks[2].value as any[])[0]?.c ?? 0) : 0;
  if (stockOut > 0) {
    alerts.push({ id:'stock-rupture', level:'critical', module:'Stock médical',
      message:`${stockOut} article(s) en rupture de stock`,
      value:stockOut,
      action:'Voir le stock critique', generatedAt:now });
  }

  // Vital equipment out
  const vitalDown = checks[3].status==='fulfilled' ? Number((checks[3].value as any[])[0]?.c ?? 0) : 0;
  if (vitalDown > 0) {
    alerts.push({ id:'biomed-vital', level:'critical', module:'Biomédical',
      message:`${vitalDown} équipement(s) critique(s) en panne`,
      value:vitalDown,
      action:'Voir les équipements', generatedAt:now });
  }

  // Quality incident
  const qCrit = checks[4].status==='fulfilled' ? Number((checks[4].value as any[])[0]?.c ?? 0) : 0;
  if (qCrit > 0) {
    alerts.push({ id:'quality-crit', level:'critical', module:'Qualité',
      message:`${qCrit} incident(s) qualité critique(s) ouvert(s)`,
      value:qCrit,
      action:'Voir les incidents', generatedAt:now });
  }

  // Overdue insurance claims
  const overdueClaims = checks[5].status==='fulfilled' ? Number((checks[5].value as any[])[0]?.c ?? 0) : 0;
  if (overdueClaims > 0) {
    alerts.push({ id:'insurance-overdue', level:'warning', module:'Assurance',
      message:`${overdueClaims} dossier(s) assurance en attente depuis >30 jours`,
      value:overdueClaims,
      action:'Voir les dossiers assurance', generatedAt:now });
  }

  // Under-staffed
  const underStaff = checks[6].status==='fulfilled' ? Number((checks[6].value as any[])[0]?.c ?? 0) : 0;
  if (underStaff > 0) {
    alerts.push({ id:'hr-understaff', level:'warning', module:'RH',
      message:`${underStaff} service(s) sous-effectif aujourd'hui (présence <70%)`,
      value:underStaff,
      action:'Voir les présences RH', generatedAt:now });
  }

  // Revenue below average
  const rev = checks[7].status==='fulfilled' ? (checks[7].value as any[])[0] : null;
  if (rev && Number(rev.avg_daily) > 0 && Number(rev.today_rev) < Number(rev.avg_daily) * 0.6) {
    alerts.push({ id:'revenue-low', level:'warning', module:'Finance',
      message:`Revenu du jour (${Math.round(Number(rev.today_rev)).toLocaleString()} DZD) inférieur à la moyenne`,
      action:'Voir le tableau financier', generatedAt:now });
  }

  // High wait time
  const waitTime = checks[8].status==='fulfilled' ? Number((checks[8].value as any[])[0]?.avg ?? 0) : 0;
  if (waitTime > 60) {
    alerts.push({ id:'wait-high', level:'warning', module:'Urgences',
      message:`Temps d'attente urgences: ${waitTime} min (seuil: 60 min)`,
      value:waitTime, threshold:60,
      action:'Voir les urgences', generatedAt:now });
  }

  // CAPA very overdue
  const capaOD = checks[9].status==='fulfilled' ? Number((checks[9].value as any[])[0]?.c ?? 0) : 0;
  if (capaOD > 0) {
    alerts.push({ id:'capa-overdue', level:'warning', module:'Qualité',
      message:`${capaOD} CAPA en retard de plus de 14 jours`,
      value:capaOD,
      action:'Voir les CAPA', generatedAt:now });
  }

  // Sort: critical first
  alerts.sort((a,b) => {
    const p = { critical:0, warning:1, info:2 };
    return p[a.level] - p[b.level];
  });

  res.json({ generatedAt: now, count: alerts.length, alerts });
});

export default router;
