/**
 * /operating-rooms — standalone read-only router for OR room listing.
 * Write operations (schedule/start/complete) go through /surgical-requests.
 */
import { Router } from "express";
import { SurgicalRequestRepository } from "../repositories/surgicalRequest";
import type { DbOperatingRoom } from "../repositories/surgicalRequest";

const router = Router();
const surgRepo = new SurgicalRequestRepository();

function mapOR(r: DbOperatingRoom) {
  return {
    id:                       r.id,
    name:                     r.name,
    shortName:                r.shortName,
    specialty:                r.specialty ?? null,
    status:                   r.status,
    currentSurgicalRequestId: r.currentSurgicalRequestId ?? null,
    floorLabel:               r.floorLabel ?? null,
    updatedAt:                r.updatedAt.toISOString(),
  };
}

/** GET /operating-rooms */
router.get("/", async (_req, res, next) => {
  try {
    const rooms = await surgRepo.listRooms();
    res.json(rooms.map(mapOR));
  } catch (err) { next(err); }
});

/** GET /operating-rooms/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const room = await surgRepo.findRoomById(String(req.params.id));
    if (!room) { res.status(404).json({ error: "Salle introuvable" }); return; }
    res.json(mapOR(room));
  } catch (err) { next(err); }
});

export default router;
