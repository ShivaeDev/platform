import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import { CodexLimits, GithubLimits } from "#browser/diagnostics/schema.ts";
import { FleetItems } from "./fleetItems.ts";
import { FleetHealth } from "./health.ts";

const Timestamp = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000));

function observation<TSchema extends Schema.Top>(value: TSchema) {
	return Schema.Union([
		Schema.Struct({ observedAt: Timestamp, state: Schema.Literal("ready"), value }),
		Schema.Struct({ cause: Schema.String, observedAt: Timestamp, state: Schema.Literals(["not-configured", "error"]) }),
	]);
}

export const DiagnosticsSnapshot = Schema.Struct({
	codex: observation(CodexLimits),
	fleet: observation(FleetHealth),
	github: observation(GithubLimits),
});
export type DiagnosticsSnapshot = typeof DiagnosticsSnapshot.Type;

export const DiagnosticsContract = contract("daemon", {
	queries: [
		query("diagnostics", { payload: {}, reads: () => [], success: DiagnosticsSnapshot }),
		query("fleetItems", { payload: {}, reads: () => [], success: FleetItems }),
	],
});
export const DAEMON_RPC_PATH = "/_fleet/rpc";
export const DAEMON_PORT = 3457;
