/**
 * Workflow Engine — Emergency Department State Machine
 *
 * Phase 4 of Production Logic: "كل Statut يسمح فقط بالانتقالات الصحيحة"
 *
 * Rules:
 *   - Only transitions listed in ALLOWED_TRANSITIONS are permitted.
 *   - Terminal states (sorti, transfere, decede) cannot be left.
 *   - The decede state is locked — only a super admin can alter it (enforced at UI level).
 *   - Any attempt to skip states is silently rejected (returns false from canTransition).
 *
 * This is pure business logic — no React, no side effects.
 */

import type { EmergencyPatientStatus } from '@/types/emergency';

// ─── Transition Matrix ────────────────────────────────────────────────────────

export const ALLOWED_TRANSITIONS: Record<EmergencyPatientStatus, EmergencyPatientStatus[]> = {
  attente_triage: ['en_triage'],
  en_triage:      ['attente_soins', 'attente_triage'],  // can go back if re-triage needed
  attente_soins:  ['en_soins', 'en_triage'],            // can be sent back to triage
  en_soins:       ['observation', 'hospitalise', 'sorti', 'transfere', 'decede'],
  observation:    ['en_soins', 'hospitalise', 'sorti', 'transfere', 'decede'],
  hospitalise:    ['sorti', 'transfere', 'decede'],
  sorti:          [],     // Terminal — patient has left
  transfere:      [],     // Terminal — patient transferred
  decede:         [],     // Terminal + Locked — requires super admin to modify
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if transitioning from → to is a valid step.
 * Returns false for any skip, reversal not explicitly allowed, or terminal state.
 */
export function canTransition(
  from: EmergencyPatientStatus,
  to:   EmergencyPatientStatus,
): boolean {
  if (from === to) return false;   // No-op is not a valid transition
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Returns the list of states reachable from the current state. */
export function getAllowedTransitions(
  from: EmergencyPatientStatus,
): EmergencyPatientStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

/** True if the patient has permanently left the emergency unit. */
export function isTerminalStatus(status: EmergencyPatientStatus): boolean {
  return ['sorti', 'transfere', 'decede'].includes(status);
}

/** True if the file is immutably locked (deceased — super admin only). */
export function isLockedStatus(status: EmergencyPatientStatus): boolean {
  return status === 'decede';
}

/**
 * True if "Prendre en charge" / startCare is allowed from this status.
 * Patients who are already in care or at a terminal state cannot be re-started.
 */
export function canStartCare(status: EmergencyPatientStatus): boolean {
  return ['attente_triage', 'en_triage', 'attente_soins'].includes(status);
}

/** Human-readable label for each status transition (for audit logs). */
export const TRANSITION_LABELS: Record<EmergencyPatientStatus, string> = {
  attente_triage: 'En attente de triage',
  en_triage:      'En triage',
  attente_soins:  'En attente de soins',
  en_soins:       'En soins',
  observation:    'Sous observation',
  hospitalise:    'Hospitalisé',
  sorti:          'Sorti (domicile)',
  transfere:      'Transféré',
  decede:         'Décédé',
};
