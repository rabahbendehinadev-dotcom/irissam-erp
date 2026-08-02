/**
 * Services barrel export.
 * Import service singletons and types from here throughout route handlers.
 *
 * Usage example in a route:
 *   import { patientService, admissionService } from "../services";
 *   import type { ActorCtx } from "../repositories";
 */

export * from "./audit";
export * from "./patient";
export * from "./encounter";
export * from "./admission";
export * from "./clinicalOrder";
export * from "./pharmacy";
export * from "./consultation";
export * from "./appointment";
