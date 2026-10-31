import { DAEMON_PORT, DAEMON_RPC_PATH, DiagnosticsContract } from "#diagnostics/daemonContract.ts";
import { FleetStage, FleetTimestamp } from "#diagnostics/fleetItems.ts";
import { CapacityRejection as CapacityRejectionSchema, FLEET_HEALTH_NAME, FleetHealth as FleetHealthSchema } from "#diagnostics/health.ts";
import { DiagnosticsSources, diagnostics as readDiagnostics, SourceFailure as SourceFailureClass } from "#diagnostics/source.ts";
import { codexLimits } from "#server/diagnostics/codexLimits.ts";
import { codexRateLimits } from "#server/diagnostics/codexRateLimits.ts";
import { fleetHealth } from "#server/diagnostics/fleetHealth.ts";
import { githubLimits } from "#server/diagnostics/githubLimits.ts";

export type CapacityRejection = typeof CapacityRejectionSchema.Type;
export type FleetHealth = typeof FleetHealthSchema.Type;

export const diagnostics = {
	CapacityRejection: CapacityRejectionSchema,
	codexLimits,
	codexRateLimits,
	DAEMON_PORT,
	DAEMON_RPC_PATH,
	DiagnosticsContract,
	DiagnosticsSources,
	diagnostics: readDiagnostics,
	FLEET_HEALTH_NAME,
	FleetHealth: FleetHealthSchema,
	FleetStage,
	FleetTimestamp,
	fleetHealth,
	githubLimits,
	SourceFailure: SourceFailureClass,
} as const;
