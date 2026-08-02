/**
 * AppointmentService — appointment scheduling.
 *
 * Key schema alignment (appointments.ts):
 *  - departmentName: text not null (no `service` column)
 *  - patientName: text not null (no patientFirstName/patientLastName)
 *  - id: UUID (not integer)
 *  - scheduledAt: timestamp
 */
import { repos } from "../repositories";
import { auditService } from "./audit";
import type { TxContext, ActorCtx } from "../repositories/types";
import type { DbAppointment } from "../repositories/appointment";
import type { InsertAppointment } from "@workspace/db";

export type CreateAppointmentInput = Omit<InsertAppointment, "createdBy" | "updatedBy">;

export class AppointmentService {

  async list(opts: Parameters<typeof repos.appointment.list>[0] = {}) {
    return repos.appointment.list(opts);
  }

  async upcoming(fromDate: Date, toDate: Date, limit = 5) {
    return repos.appointment.list({ fromDate, toDate, limit });
  }

  async findById(id: string): Promise<DbAppointment | null> {
    return repos.appointment.findById(id);
  }

  async create(input: CreateAppointmentInput, actor: ActorCtx): Promise<DbAppointment> {
    const ctx: TxContext = { ...actor };
    const appointment = await repos.appointment.create(input, ctx);
    await auditService.log({
      module:       "consultations",
      action:       "created",
      resourceType: "appointment",
      resourceId:   appointment.id,
      newValue:     { doctorName: input.doctorName, scheduledAt: input.scheduledAt },
      patientId:    input.patientId ?? undefined,
    }, actor);
    return appointment;
  }

  async updateStatus(id: string, status: string, actor: ActorCtx): Promise<DbAppointment | null> {
    const ctx: TxContext = { ...actor };
    const updated = await repos.appointment.updateStatus(id, status, ctx);
    if (updated) {
      await auditService.log({
        module:       "consultations",
        action:       "status_changed",
        resourceType: "appointment",
        resourceId:   id,
        newValue:     { status },
      }, actor);
    }
    return updated;
  }
}

export const appointmentService = new AppointmentService();
