import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/finance
router.get('/', requirePermission('executive.view_finance'), async (req, res) => {
  const { period = 'month', from, to, site_id } = req.query as Record<string,string>;
  const now = new Date();
  let start = new Date(now); let end = new Date(now);
  if (from && to) { start = new Date(from); end = new Date(to); }
  else {
    switch (period) {
      case 'week':   start.setDate(now.getDate()-6); break;
      case 'year':   start.setMonth(0,1); break;
      case 'quarter':start.setMonth(Math.floor(now.getMonth()/3)*3,1); break;
      default:       start.setDate(1);
    }
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  }
  const sf = site_id ? `AND site_id='${site_id}'` : '';

  const [revenueByMonth, paymentsByMethod, unpaidByAge, insuranceSplit,
         revenueByService, paymentTrend] = await Promise.all([
    // Revenue trend last 12 months
    safe(() => db.query(`
      SELECT DATE_TRUNC('month',invoice_date)::date as month,
        COALESCE(SUM(total_amount),0) as revenue,
        COALESCE(SUM(paid_amount),0)  as paid,
        COALESCE(SUM(remaining_amount),0) as unpaid
      FROM invoices WHERE deleted_at IS NULL ${sf}
        AND invoice_date >= NOW()-INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1`, []), []),
    // Payments by method in period
    safe(() => db.query(`
      SELECT p.method, COUNT(*) as count, COALESCE(SUM(p.amount),0) as total
      FROM payments p
      WHERE p.paid_at >= $1 AND p.paid_at <= $2
      GROUP BY p.method ORDER BY total DESC`, [start, end]), []),
    // Unpaid invoices by age bucket
    safe(() => db.query(`
      SELECT
        CASE
          WHEN NOW()-invoice_date < INTERVAL '30 days'  THEN '0-30j'
          WHEN NOW()-invoice_date < INTERVAL '60 days'  THEN '31-60j'
          WHEN NOW()-invoice_date < INTERVAL '90 days'  THEN '61-90j'
          ELSE '>90j'
        END as bucket,
        COUNT(*) as count, COALESCE(SUM(remaining_amount),0) as amount
      FROM invoices WHERE deleted_at IS NULL AND status NOT IN ('paid','cancelled') ${sf}
      GROUP BY 1 ORDER BY MIN(NOW()-invoice_date)`, []), []),
    // Insurance split: patient vs insurer share
    safe(() => db.query(`
      SELECT
        COALESCE(SUM(patient_share),0)  as patient_share,
        COALESCE(SUM(insurer_share),0)  as insurer_share,
        COALESCE(SUM(total_amount),0)   as total,
        COALESCE(SUM(CASE WHEN insurance_type='CNAS'   THEN insurer_share END),0) as cnas,
        COALESCE(SUM(CASE WHEN insurance_type='CASNOS' THEN insurer_share END),0) as casnos,
        COALESCE(SUM(CASE WHEN insurance_type NOT IN ('CNAS','CASNOS') AND insurance_type IS NOT NULL
          THEN insurer_share END),0) as other_insurer
      FROM invoices WHERE deleted_at IS NULL AND invoice_date >= $1 AND invoice_date <= $2 ${sf}`, [start, end]), []),
    // Revenue by service in period
    safe(() => db.query(`
      SELECT COALESCE(i.service_id::text,'Autre') as service,
        COALESCE(SUM(i.total_amount),0) as revenue
      FROM invoices i WHERE i.deleted_at IS NULL AND i.invoice_date >= $1 AND i.invoice_date <= $2 ${sf}
      GROUP BY i.service_id ORDER BY revenue DESC LIMIT 10`, [start, end]), []),
    // Daily payment trend in period
    safe(() => db.query(`
      SELECT DATE_TRUNC('day',paid_at)::date as day,
        COALESCE(SUM(amount),0) as total, COUNT(*) as count
      FROM payments WHERE paid_at >= $1 AND paid_at <= $2
      GROUP BY 1 ORDER BY 1`, [start, end]), []),
  ]);

  const ins = (insuranceSplit as any[])[0] ?? {};
  res.json({
    period: { type: period, start, end },
    revenueByMonth,
    paymentsByMethod,
    unpaidByAge,
    insuranceSplit: {
      patientShare:  Number(ins.patient_share  ?? 0),
      insurerShare:  Number(ins.insurer_share  ?? 0),
      total:         Number(ins.total          ?? 0),
      cnas:          Number(ins.cnas           ?? 0),
      casnos:        Number(ins.casnos         ?? 0),
      otherInsurer:  Number(ins.other_insurer  ?? 0),
    },
    revenueByService,
    paymentTrend,
  });
});

export default router;
