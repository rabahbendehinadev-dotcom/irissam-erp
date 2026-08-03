/**
 * InsuranceCoverageEngine
 *
 * All monetary arithmetic uses JavaScript's built-in BigInt-backed NUMERIC
 * emulation via string-based rounding to 2 decimal places.
 *
 * Rule: NEVER do final coverage calculations in the frontend.
 * This service is the single source of truth for all coverage math.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoveragePolicy {
  coveragePercent: number;        // e.g. 80.00
  ceilingAmount: number | null;   // annual ceiling in DZD (null = unlimited)
  ceilingConsumed: number;        // already consumed from annual ceiling
  ticketModerateur: number;       // % applied to patient share on top of non-covered
  franchiseAmount: number;        // fixed amount subtracted from org share
  excludedServices: string[];     // service codes excluded from coverage
  coveredServices: string[] | null; // if set, only these codes are covered
  tarifsConventionnes: Record<string, number> | null; // {serviceCode: conventionPrice}
  maxActsPerYear: number | null;
  requiresPriorAuth: boolean;
  waitingPeriodDays: number;
  policyStartDate: Date | null;
}

export interface ServiceItem {
  serviceCode: string;
  description: string;
  amountBilled: number;
  quantity?: number;
}

export interface ServiceCoverageResult {
  serviceCode: string;
  description: string;
  amountBilled: number;
  amountEligible: number;    // after applying tarif conventionné
  covered: boolean;
  exclusionReason: string | null;
  amountOrganisme: number;
  amountPatient: number;
  cappedByPlafond: boolean;
}

export interface CoverageBreakdown {
  // Totals
  totalFacture: number;
  totalEligible: number;        // after convention tarifs
  totalNonCouvert: number;      // excluded services
  plafondDisponible: number;    // ceiling - consumed
  franchiseApplied: number;
  ticketModerateurAmount: number;
  // Shares
  partOrganisme: number;
  partPatient: number;
  // Detail
  cappedByPlafond: boolean;
  services: ServiceCoverageResult[];
  // String representations for safe DB storage
  partOrganismeStr: string;
  partPatientStr: string;
  plafondDisponibleStr: string;
  totalFactureStr: string;
}

// ─── Rounding helper ─────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toStr(n: number): string {
  return n.toFixed(2);
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export class InsuranceCoverageEngine {
  /**
   * Calculate full coverage breakdown for a list of services against a policy.
   * Returns per-service breakdown + aggregate totals.
   */
  calculate(policy: CoveragePolicy, services: ServiceItem[]): CoverageBreakdown {
    const plafondDisponible =
      policy.ceilingAmount !== null
        ? round2(Math.max(0, policy.ceilingAmount - policy.ceilingConsumed))
        : Infinity;

    let totalFacture = 0;
    let totalEligible = 0;
    let totalNonCouvert = 0;
    let orgShareRaw = 0;
    let plafondUsed = 0;
    const serviceResults: ServiceCoverageResult[] = [];

    for (const svc of services) {
      const billed = round2(svc.amountBilled);
      totalFacture = round2(totalFacture + billed);

      // Check waiting period
      if (
        policy.waitingPeriodDays > 0 &&
        policy.policyStartDate !== null
      ) {
        const daysSinceStart = Math.floor(
          (Date.now() - policy.policyStartDate.getTime()) / 86400000,
        );
        if (daysSinceStart < policy.waitingPeriodDays) {
          serviceResults.push({
            serviceCode: svc.serviceCode,
            description: svc.description,
            amountBilled: billed,
            amountEligible: 0,
            covered: false,
            exclusionReason: `Délai de carence non écoulé (${policy.waitingPeriodDays} jours)`,
            amountOrganisme: 0,
            amountPatient: billed,
            cappedByPlafond: false,
          });
          totalNonCouvert = round2(totalNonCouvert + billed);
          continue;
        }
      }

      // Check excluded services
      if (policy.excludedServices.includes(svc.serviceCode)) {
        serviceResults.push({
          serviceCode: svc.serviceCode,
          description: svc.description,
          amountBilled: billed,
          amountEligible: 0,
          covered: false,
          exclusionReason: "Service exclu du contrat",
          amountOrganisme: 0,
          amountPatient: billed,
          cappedByPlafond: false,
        });
        totalNonCouvert = round2(totalNonCouvert + billed);
        continue;
      }

      // Check covered services whitelist
      if (
        policy.coveredServices !== null &&
        policy.coveredServices.length > 0 &&
        !policy.coveredServices.includes(svc.serviceCode)
      ) {
        serviceResults.push({
          serviceCode: svc.serviceCode,
          description: svc.description,
          amountBilled: billed,
          amountEligible: 0,
          covered: false,
          exclusionReason: "Service non prévu par le contrat",
          amountOrganisme: 0,
          amountPatient: billed,
          cappedByPlafond: false,
        });
        totalNonCouvert = round2(totalNonCouvert + billed);
        continue;
      }

      // Apply tarif conventionné if applicable
      let eligible = billed;
      if (
        policy.tarifsConventionnes !== null &&
        policy.tarifsConventionnes[svc.serviceCode] !== undefined
      ) {
        const tarif = policy.tarifsConventionnes[svc.serviceCode];
        const qty = svc.quantity ?? 1;
        eligible = round2(tarif * qty);
      }
      totalEligible = round2(totalEligible + eligible);

      // Apply coverage percent
      let orgAmount = round2(eligible * (policy.coveragePercent / 100));

      // Check plafond (annual ceiling)
      let cappedByPlafond = false;
      if (plafondDisponible !== Infinity) {
        const remaining = round2(plafondDisponible - plafondUsed);
        if (remaining <= 0) {
          orgAmount = 0;
          cappedByPlafond = true;
        } else if (orgAmount > remaining) {
          orgAmount = remaining;
          cappedByPlafond = true;
        }
      }
      plafondUsed = round2(plafondUsed + orgAmount);
      orgShareRaw = round2(orgShareRaw + orgAmount);

      const patAmount = round2(billed - orgAmount);

      serviceResults.push({
        serviceCode: svc.serviceCode,
        description: svc.description,
        amountBilled: billed,
        amountEligible: eligible,
        covered: true,
        exclusionReason: null,
        amountOrganisme: orgAmount,
        amountPatient: patAmount,
        cappedByPlafond,
      });
    }

    // Apply franchise (deducted from org share)
    const franchiseApplied = round2(
      Math.min(policy.franchiseAmount, orgShareRaw),
    );
    let partOrganisme = round2(orgShareRaw - franchiseApplied);

    // Ticket modérateur (percentage added to patient share from org share)
    let ticketModerateurAmount = 0;
    if (policy.ticketModerateur > 0) {
      ticketModerateurAmount = round2(partOrganisme * (policy.ticketModerateur / 100));
      partOrganisme = round2(partOrganisme - ticketModerateurAmount);
    }

    const partPatient = round2(totalFacture - partOrganisme);

    const finalPlafondDisponible =
      plafondDisponible === Infinity ? 0 : round2(Math.max(0, plafondDisponible - plafondUsed));

    return {
      totalFacture: round2(totalFacture),
      totalEligible: round2(totalEligible),
      totalNonCouvert: round2(totalNonCouvert),
      plafondDisponible:
        plafondDisponible === Infinity
          ? -1  // sentinel for unlimited
          : finalPlafondDisponible,
      franchiseApplied,
      ticketModerateurAmount,
      partOrganisme,
      partPatient,
      cappedByPlafond: plafondUsed >= (plafondDisponible === Infinity ? 0 : plafondDisponible) && plafondDisponible !== Infinity,
      services: serviceResults,
      // String representations safe for NUMERIC DB columns
      partOrganismeStr: toStr(partOrganisme),
      partPatientStr: toStr(partPatient),
      plafondDisponibleStr: plafondDisponible === Infinity ? "-1.00" : toStr(finalPlafondDisponible),
      totalFactureStr: toStr(round2(totalFacture)),
    };
  }

  /**
   * Check if a specific service is covered under a policy.
   */
  isServiceCovered(
    policy: Pick<CoveragePolicy, "excludedServices" | "coveredServices">,
    serviceCode: string,
  ): { covered: boolean; reason: string | null } {
    if (policy.excludedServices.includes(serviceCode)) {
      return { covered: false, reason: "Service exclu du contrat" };
    }
    if (
      policy.coveredServices !== null &&
      policy.coveredServices.length > 0 &&
      !policy.coveredServices.includes(serviceCode)
    ) {
      return { covered: false, reason: "Service non prévu par le contrat" };
    }
    return { covered: true, reason: null };
  }

  /**
   * Check remaining plafond for a policy.
   */
  checkPlafond(
    ceilingAmount: number | null,
    ceilingConsumed: number,
    requestedAmount: number,
  ): { available: number; sufficient: boolean; capped: boolean; cappedAmount: number } {
    if (ceilingAmount === null) {
      return { available: -1, sufficient: true, capped: false, cappedAmount: requestedAmount };
    }
    const available = round2(Math.max(0, ceilingAmount - ceilingConsumed));
    const sufficient = available >= requestedAmount;
    const cappedAmount = sufficient ? requestedAmount : available;
    return { available, sufficient, capped: !sufficient, cappedAmount };
  }
}

export const coverageEngine = new InsuranceCoverageEngine();
