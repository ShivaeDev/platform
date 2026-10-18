import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import type { BoardDecision, BoardDecisionReading } from "#board/schema.ts";
import { daemonClient } from "#host/daemonClient.ts";
import type { FleetRecord } from "#model.ts";
import { BoardGateway, type Decision } from "#policy.ts";
import { answerAndWait, dispatchAndWait } from "#test/daemonActions.ts";
import { finishWorkers } from "#test/engine.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { storeState } from "#test/storeState.ts";

const test = postgresTests("live");
const REASON = "Current observation needs another inspection";
const TEXT = "Retain the existing review feedback.";
type Window = "after-record" | "during-record" | "during-resolve";
type Replacement = "same-kind" | "different-kind" | "left-needs-human" | "repairing";

for (const replacement of ["same-kind", "different-kind", "left-needs-human", "repairing"] as const) {
	test(`answer follows the current decision after a ${replacement} replacement races response publication`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => replacementStory(fixture, replacement)));
}

for (const window of ["during-record", "during-resolve"] as const) {
	test(`same-kind answer follows a replacement ${window} when the old Board question becomes stale`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => replacementStory(fixture, "same-kind", window)));
}

const replacementStory = Effect.fn("AnswerReplacementTest.replacementStory")(function* (
	fixture: HostFixture,
	replacement: Replacement,
	window: Window = "after-record",
) {
	if (fixture.parts.board === undefined) {
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
	).pipe(Layer.provideMerge(fixture.parts.board));
	return yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				yield* dispatchAndWait(client, "one");
				finishWorkers(fixture.provider);
				const waiting = yield* client("fleet.reconcile", { workId: "one" });
				const decision = waiting.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Expected an open decision");
				}
				remaining = window === "during-resolve" ? 2 : 1;
				const sourcePath = decision.published.sourcePath;
				replace = storeState(fixture.host, "one", replacedRecord(waiting, decision, replacement)).pipe(
					Effect.andThen(staleSource(fixture, sourcePath, window)),
					Effect.provideService(SqlClient.SqlClient, sql),
				);
				const result = yield* answerAndWait(client, { text: TEXT, workId: "one" }).pipe(Effect.result);
				yield* assertReplacementOutcome(client, replacement, decision.id, result);
			}),
		{ parts: { ...fixture.parts, board } },
	);
});

const assertReplacementOutcome = Effect.fn("AnswerReplacementTest.assertReplacementOutcome")(function* (
	client: Effect.Success<ReturnType<typeof daemonClient>>,
	replacement: Replacement,
	decisionId: string,
	result: unknown,
) {
	const expected = replacementResult(replacement, decisionId);
	expect(result).toMatchObject(expected);
	if (expected._tag === "Failure") {
		expect((yield* client("fleet.get", { workId: "one" })).responses ?? []).toHaveLength(0);
	} else if (replacement === "same-kind") {
		expect((yield* client("fleet.get", { workId: "one" })).decision).toBeUndefined();
	}
	if (replacement === "different-kind") {
		expect((yield* answerAndWait(client, { release: true, workId: "one" })).stage).toBe("released");
	}
});

function replacedRecord(waiting: FleetRecord, decision: Decision, replacement: Replacement): FleetRecord {
	if (replacement === "left-needs-human" || replacement === "repairing") {
		return { ...waiting, blocker: REASON, decision: undefined, stage: replacement === "repairing" ? "repairing" : "validating" };
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

function replacementResult(replacement: Replacement, decisionId: string) {
	if (replacement === "different-kind" || replacement === "left-needs-human") {
		return { _tag: "Failure", failure: { _tag: "Conflict", message: `Decision changed: ${REASON}` } };
	}
	if (replacement === "repairing") {
		return { _tag: "Success", success: { pendingAnswers: [TEXT], stage: "repairing" } };
	}
	return {
		_tag: "Success",
		success: {
			responses: [{ action: "retry", boardAcknowledged: true, decisionId: `${decisionId}.replacement` }],
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
