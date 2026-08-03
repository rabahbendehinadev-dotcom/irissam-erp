import { Router } from 'express';
import { db } from '@workspace/db';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

// GET /api/executive-dashboard/stock
router.get('/', requirePermission('executive.view_stock'), async (req, res) => {
  const { period = 'month', from, to } = req.query as Record<string,string>;
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

  const [stockValue, criticalItems, expiringBatches, topConsumed, stockouts, pendingOrders] = await Promise.all([
    safe(() => db.query(`
      SELECT
        COALESCE(SUM(quantity_on_hand * unit_cost), 0) as total_value,
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE quantity_on_hand <= reorder_point) as critical,
        COUNT(*) FILTER (WHERE quantity_on_hand = 0) as stockout
      FROM medical_items WHERE is_active=true AND deleted_at IS NULL`, []), []),
    safe(() => db.query(`
      SELECT mi.code, mi.name, mi.item_type,
        mi.quantity_on_hand, mi.reorder_point, mi.min_stock_level,
        mi.unit_cost,
        ROUND((mi.quantity_on_hand::float / NULLIF(mi.reorder_point,0))*100,1) as stock_pct
      FROM medical_items mi
      WHERE mi.is_active=true AND mi.deleted_at IS NULL
        AND mi.quantity_on_hand <= mi.reorder_point
      ORDER BY stock_pct ASC LIMIT 20`, []), []),
    safe(() => db.query(`
      SELECT mb.batch_number, mi.name as item_name,
        mb.expiry_date, mb.quantity_on_hand,
        EXTRACT(DAY FROM mb.expiry_date - NOW())::int as days_left,
        mb.quantity_on_hand * mi.unit_cost as value
      FROM medical_batches mb
      JOIN medical_items mi ON mi.id=mb.item_id AND mi.deleted_at IS NULL
      WHERE mb.expiry_date <= NOW()+INTERVAL '90 days'
        AND mb.expiry_date > NOW()
        AND mb.quantity_on_hand > 0
        AND mb.deleted_at IS NULL
      ORDER BY mb.expiry_date ASC LIMIT 20`, []), []),
    safe(() => db.query(`
      SELECT mi.name, mi.item_type,
        COALESCE(SUM(mc.quantity_dispensed),0) as consumed,
        COALESCE(SUM(mc.quantity_dispensed * mi.unit_cost),0) as value
      FROM medical_consumptions mc
      JOIN medical_items mi ON mi.id=mc.item_id AND mi.deleted_at IS NULL
      WHERE mc.consumed_at >= $1 AND mc.consumed_at <= $2 AND mc.deleted_at IS NULL
      GROUP BY mi.name, mi.item_type ORDER BY consumed DESC LIMIT 10`, [start, end]), []),
    safe(() => db.query(`
      SELECT mi.code, mi.name, mi.quantity_on_hand, mi.unit_cost
      FROM medical_items mi
      WHERE mi.is_active=true AND mi.deleted_at IS NULL AND mi.quantity_on_hand = 0
      ORDER BY mi.name LIMIT 20`, []), []),
    safe(() => db.query(`
      SELECT po.order_number, po.status, po.total_amount,
        po.expected_delivery_date, COUNT(poi.id) as line_count
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.order_id=po.id
      WHERE po.status NOT IN ('delivered','cancelled') AND po.deleted_at IS NULL
      GROUP BY po.id, po.order_number, po.status, po.total_amount, po.expected_delivery_date
      ORDER BY po.created_at DESC LIMIT 10`, []), []),
  ]);

  const sv = (stockValue as any[])[0] ?? {};
  res.json({
    period: { type: period, start, end },
    summary: {
      totalValue:   Number(sv.total_value ?? 0),
      totalItems:   Number(sv.total_items ?? 0),
      critical:     Number(sv.critical    ?? 0),
      stockout:     Number(sv.stockout    ?? 0),
    },
    criticalItems,
    expiringBatches,
    topConsumed,
    stockouts,
    pendingOrders,
  });
});

export default router;
