import type { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import type { DecisionCode } from "#DecisionCode.ts";
import { queueRecovery } from "#test/queueRecovery.ts";
import { quotaRecovery } from "#test/quotaRecovery.ts";

interface RecoveryCapacityCase {
	readonly code: DecisionCode;
	readonly name: string;
	readonly run: () => Effect.Effect<unknown, unknown, SqlClient.SqlClient>;
}

export const recoveryCapacityCases: readonly RecoveryCapacityCase[] = [
	...(["session", "turn"] as const).map((call) => ({
		code: "session-queue-full" as const,
		name: `reworded ${call} rejection preserves automatic backoff after restart`,
		run: () => queueRecovery(call),
	})),
	{
		code: "provider-quota-unavailable",
		name: "reworded admission denial preserves quota waiting and resumes after restart",
		run: quotaRecovery,
	},
];
