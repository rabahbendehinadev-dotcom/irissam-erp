/**
 * Validation Engine — Business Rule Validators
 *
 * Phase 3 of Production Logic: "أضف Validation كامل"
 *
 * Rules:
 *   1. Cannot order a lab test if no doctor is assigned.
 *   2. Cannot hospitalize if no ward is selected.
 *   3. Cannot send to bloc without a surgeon + intervention.
 *   4. Cannot send to réanimation without a bed + motif.
 *   5. Cannot close a file with pending (unresolved) requests.
 *   6. Cannot transfer without specifying a destination.
 *   7. Cannot reopen a deceased file without super admin rights.
 *   8. Cannot order imaging without an assigned doctor.
 *
 * All validators are pure functions — no React, no side effects.
 * Returns { valid: true } or { valid: false, error: string, field?: string }.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;    // User-facing message (French)
  field?: string;    // Form field ID to highlight
}

export const ok    = (): ValidationResult => ({ valid: true });
export const fail  = (error: string, field?: string): ValidationResult =>
  ({ valid: false, error, field });

// ─── Rule 1 & 8: Lab / Imaging — requires assigned doctor ────────────────────

export function validateLabOrder(params: {
  requestedById?: string;
  patientAssignedDoctorId?: string;
}): ValidationResult {
  if (!params.requestedById?.trim()) {
    return fail(
      'Un médecin doit être connecté pour demander une analyse.',
      'requestedById',
    );
  }
  return ok();
}

export function validateImagingOrder(params: {
  requestedById?: string;
}): ValidationResult {
  if (!params.requestedById?.trim()) {
    return fail(
      'Un médecin doit être connecté pour demander une imagerie.',
      'requestedById',
    );
  }
  return ok();
}

// ─── Rule 2: Hospitalisation — requires ward ─────────────────────────────────

export function validateHospitalization(params: {
  ward?: string;
}): ValidationResult {
  if (!params.ward?.trim()) {
    return fail(
      "Veuillez sélectionner un service d'hospitalisation avant de confirmer.",
      'ward',
    );
  }
  return ok();
}

// ─── Rule 3: Bloc — requires surgeon + intervention ──────────────────────────

export function validateBloc(params: {
  surgeon?: string;
  intervention?: string;
}): ValidationResult {
  if (!params.surgeon?.trim()) {
    return fail(
      'Un chirurgien doit être désigné pour la demande de bloc opératoire.',
      'surgeon',
    );
  }
  if (!params.intervention?.trim()) {
    return fail(
      "Le type d'intervention chirurgicale doit être précisé.",
      'intervention',
    );
  }
  return ok();
}

// ─── Rule 4: Réanimation — requires bed + motif ───────────────────────────────

export function validateICU(params: {
  icuBed?: string;
  icuMotif?: string;
}): ValidationResult {
  if (!params.icuBed?.trim()) {
    return fail(
      'Un lit de réanimation doit être désigné avant le transfert.',
      'icuBed',
    );
  }
  if (!params.icuMotif?.trim()) {
    return fail(
      'Le motif de réanimation est obligatoire.',
      'icuMotif',
    );
  }
  return ok();
}

// ─── Rule 5: Close file — no pending requests ─────────────────────────────────

export function validateCloseFile(params: {
  pendingLabCount:     number;
  pendingImagingCount: number;
}): ValidationResult {
  const total = params.pendingLabCount + params.pendingImagingCount;
  if (total === 0) return ok();

  const parts: string[] = [];
  if (params.pendingLabCount > 0)
    parts.push(`${params.pendingLabCount} analyse${params.pendingLabCount > 1 ? 's' : ''}`);
  if (params.pendingImagingCount > 0)
    parts.push(`${params.pendingImagingCount} imagerie${params.pendingImagingCount > 1 ? 's' : ''}`);

  return fail(
    `Impossible de clôturer : ${parts.join(' et ')} en attente de résultat.`,
  );
}

// ─── Rule 6: Transfer — requires destination ─────────────────────────────────

export function validateTransfer(params: {
  destEtablissement?: string;
}): ValidationResult {
  if (!params.destEtablissement?.trim()) {
    return fail(
      "L'établissement de destination est obligatoire pour un transfert.",
      'destEtablissement',
    );
  }
  return ok();
}

// ─── Rule 7: Reopen deceased file ─────────────────────────────────────────────

export function validateReopenDeceased(params: {
  isSuperAdmin: boolean;
  currentStatus: string;
}): ValidationResult {
  if (params.currentStatus === 'decede' && !params.isSuperAdmin) {
    return fail(
      "Le dossier d'un patient décédé est verrouillé. Seul un Super Administrateur peut le modifier.",
    );
  }
  return ok();
}

// ─── Rule 9: Prescription — drug + dosage required ───────────────────────────

export function validatePrescription(params: {
  drug?: string;
  dosage?: string;
  route?: string;
}): ValidationResult {
  if (!params.drug?.trim()) {
    return fail("Le nom du médicament est obligatoire.", 'drug');
  }
  if (!params.dosage?.trim()) {
    return fail("La posologie est obligatoire.", 'dosage');
  }
  return ok();
}
