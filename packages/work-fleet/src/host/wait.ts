import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Duration, Effect, Random, Redacted, Schema } from "effect";
import { recordPayloads } from "#host/readOnlySql.ts";

export const WAIT_EXIT = { completed: 0, error: 1, needsHuman: 2, released: 3, timeout: 4 } as const;

export interface WaitOutcome {
	readonly code: (typeof WAIT_EXIT)[keyof typeof WAIT_EXIT];
	readonly summary: string;
}

export const WaitState = Schema.Struct({
	blocker: Schema.optional(Schema.String),
	decision: Schema.optional(Schema.Struct({ reason: Schema.String })),
	outcome: Schema.optional(Schema.Struct({ evidence: Schema.optional(Schema.Array(Schema.String)), url: Schema.optional(Schema.String) })),
	stage: Schema.String,
});
export type WaitState = typeof WaitState.Type;

export interface WaitOptions {
	readonly databaseUrl: string;
	readonly intervalMs: number;
	readonly namespace: string;
	readonly timeoutMs?: number;
	readonly workId: string;
}

const UNREACHABLE_POLLS = 20;

export function settled(workId: string, state: WaitState): WaitOutcome | undefined {
	if (state.stage === "completed") {
		const outcome = state.outcome?.url ?? state.outcome?.evidence?.join("; ");
		return { code: WAIT_EXIT.completed, summary: `${workId} completed${outcome ? `: ${outcome}` : ""}` };
	}
	if (state.stage === "needs-human") {
		return {
			code: WAIT_EXIT.needsHuman,
			summary: `${workId} needs-human: ${state.decision?.reason ?? state.blocker ?? "a Board decision is pending"}`,
		};
	}
	if (state.stage === "released") {
		return { code: WAIT_EXIT.released, summary: `${workId} released` };
	}
	return undefined;
}

// A pool per poll: a hundred idle waiters hold no PostgreSQL connection slot between reads.
function readState(options: WaitOptions) {
	return recordPayloads(options.namespace, options.workId).pipe(
		Effect.flatMap(([payload]) =>
			payload === undefined ? Effect.succeed(undefined) : Schema.decodeUnknownEffect(Schema.fromJsonString(WaitState))(payload),
		),
		Effect.provide(
			PgClient.layer({
				applicationName: "work-fleet-wait",
				connectTimeout: "10 seconds",
				maxConnections: 1,
				url: Redacted.make(options.databaseUrl),
			}),
		),
	);
}

interface Poll {
	readonly failure?: string;
	readonly last?: string;
	readonly outcome?: WaitOutcome | undefined;
}

function poll(options: WaitOptions): Effect.Effect<Poll> {
	return readState(options).pipe(
		Effect.map((state) =>
			state === undefined
				? {}
				: { last: state.blocker === undefined ? state.stage : `${state.stage}: ${state.blocker}`, outcome: settled(options.workId, state) },
		),
		Effect.catch((error) => Effect.succeed({ failure: error.message })),
	);
}

export const waitFor = Effect.fn("FleetWait.waitFor")(function* (options: WaitOptions) {
	const started = yield* Clock.currentTimeMillis;
	let unreachable = 0;
	let last = "not yet known to Fleet";
	while (true) {
		const next = yield* poll(options);
		if (next.outcome !== undefined) {
			return next.outcome;
		}
		unreachable = next.failure === undefined ? 0 : unreachable + 1;
		if (unreachable >= UNREACHABLE_POLLS) {
			return { code: WAIT_EXIT.error, summary: `${options.workId} unknown: Fleet PostgreSQL is unreachable (${next.failure})` } satisfies WaitOutcome;
		}
		last = next.last ?? last;
		if (options.timeoutMs !== undefined && (yield* Clock.currentTimeMillis) - started >= options.timeoutMs) {
			return { code: WAIT_EXIT.timeout, summary: `${options.workId} still ${last}: wait timed out` } satisfies WaitOutcome;
		}
		// Jitter keeps a hundred waiters from polling PostgreSQL in lockstep.
		yield* Effect.sleep(Duration.millis(Math.round(options.intervalMs * (yield* Random.nextBetween(0.8, 1.2)))));
	}
});
