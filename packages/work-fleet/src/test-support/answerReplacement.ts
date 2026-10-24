import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import type { BoardDecision, BoardDecisionReading } from "#board/schema.ts";
import type { FleetRecord } from "#model.ts";
import { BoardGateway, type Decision } from "#policy.ts";
import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { storeState } from "#test/storeState.ts";

const REASON = "Current observation needs another inspection";
export type Window = "after-record" | "during-record" | "during-resolve";
export type Replacement = "same-kind" | "different-kind" | "left-needs-human" | "repairing";

const races = new WeakMap<AnswerHostEngine, (waiting: FleetRecord, replacement: Replacement) => void>();
export function configureReplacementRace(engine: AnswerHostEngine, window: Window = "after-record") {
	engine.beforeStart = Effect.gen(function* () {
		if (engine.host.parts.board === undefined) {
			return yield* Effect.die("Expected the fixture Board layer");
		}
		const sql = yield* SqlClient.SqlClient;
		let replace = Effect.void;
		let remaining = 0;
		const board = Layer.effect(BoardGateway)(
			Effect.gen(function* () {
				const original = yield* BoardGateway;
				function replaceReading(input: BoardDecision) {
					return (reading: BoardDecisionReading) => {
						remaining -= 1;
						if (remaining !== 0) {
							return Effect.succeed(reading);
						}
						const effect = replace;
						replace = Effect.void;
						return effect.pipe(Effect.andThen(window === "after-record" ? Effect.succeed(reading) : original.readDecision(input)));
					};
				}
				return { ...original, readDecision: (input) => original.readDecision(input).pipe(Effect.flatMap(replaceReading(input))) };
			}),
		).pipe(Layer.provideMerge(engine.host.parts.board));

		engine.boardOverride = board;
		races.set(engine, (waiting, replacement) => {
			const decision = waiting.decision;
			if (decision?.published === undefined) {
				throw new Error("Expected an open decision");
			}
			remaining = window === "during-resolve" ? 2 : 1;
			replace = storeState(engine.host.host, "one", replacedRecord(waiting, decision, replacement)).pipe(
				Effect.andThen(staleSource(engine.host, decision.published.sourcePath, window)),
				Effect.provideService(SqlClient.SqlClient, sql),
			);
		});
	});
}

export function answerReplacementVerbs(engine: AnswerHostEngine) {
	return {
		replaceDecisionOnRead: (waiting: FleetRecord, replacement: Replacement) => {
			const arm = races.get(engine);
			if (arm === undefined) {
				throw new Error("Configure a replacement race before arming it");
			}
			arm(waiting, replacement);
		},
	};
}
function replacedRecord(waiting: FleetRecord, decision: Decision, replacement: Replacement): FleetRecord {
	if (replacement === "left-needs-human" || replacement === "repairing") {
		return { ...waiting, blocker: REASON, decision: undefined, step: replacement === "repairing" ? "repairing" : "validating" };
	}
	return {
		...waiting,
		decision: {
			...decision,
			code: replacement === "same-kind" ? decision.code : "session-ambiguous",
			id: `${decision.id}.replacement`,
			published: undefined,
			reason: REASON,
		},
	};
}

function staleSource(fixture: HostFixture, sourcePath: string, window: Window) {
	return Effect.sync(() => {
		if (window !== "after-record") {
			fixture.write(sourcePath, "# The decision was replaced\n");
		}
	});
}
