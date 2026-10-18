import { Effect } from "effect";
import { expect } from "vitest";
import { BoardAcknowledgementStale } from "#board/schema.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { Fleet } from "#fleet.ts";
import { BoardFailure } from "#policy.ts";
import { deniedDecision } from "#test/deniedDecision.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

const test = postgresTests("test");

test("unqualifiable replaced and archived decision acknowledgements close durably as superseded", () =>
	withEngine(
		{ acknowledgementQuery: () => Effect.fail(new BoardAcknowledgementStale({ message: "Question was superseded" })), denyDelivery: true },
		(fixture) =>
			Effect.gen(function* () {
				const decision = yield* deniedDecision(fixture);
				const fleet = yield* Fleet;
				const reassigned = yield* fleet.reassign("one", decision.id, "maintainer");
				expect(reassigned.value.supersededDecisions).toMatchObject([
					{ boardAcknowledgementDisposition: "superseded", published: decision.published },
				]);
				fixture.editWork("one", "board-one-renewed");
				fixture.approveWork("one", "board-one-renewed");
				const renewed = yield* prepareWork("one");
				expect(renewed.value.history?.[0]?.decision).toMatchObject({
					boardAcknowledgementDisposition: "superseded",
					id: reassigned.value.decision?.id,
				});
				expect(renewed.value.blocker).toBeUndefined();
				expect(pendingAcknowledgements(renewed.value)).toEqual([]);
				const attempts = fixture.acknowledgementAttempts.length;
				const restarted = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
				expect(restarted.version).toBe(renewed.version);
				expect(fixture.acknowledgementAttempts).toHaveLength(attempts);
				expect(fixture.acknowledgements).toHaveLength(0);
			}),
	));

test("permanently failed historical superseded acknowledgement never blocks current applied acknowledgement", () =>
	withEngine(
		{
			acknowledgementQuery: (input) =>
				input.disposition === "superseded" ? Effect.fail(new BoardFailure({ message: "Historical question unavailable" })) : Effect.void,
			denyDelivery: true,
			mainChanges: ["src/renewed.ts"],
		},
		(fixture) =>
			Effect.gen(function* () {
				const previous = yield* deniedDecision(fixture);
				fixture.editWork("one", "board-one-renewed");
				fixture.approveWork("one", "board-one-renewed");
				const fleet = yield* Fleet;
				yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/renewed.ts"] }), prompt: "Renewed work", workId: "one" });
				const pending = yield* fleet.dispatch("one");
				const currentId = pending.value.decision?.id ?? "missing";
				expect(currentId).not.toBe(previous.id);
				const responseId = fixture.respond(currentId, "release");
				const applied = yield* fleet.resolve("one", currentId, responseId);
				expect(applied.value.stage).toBe("released");
				expect(applied.value.responses?.[0]?.boardAcknowledged).toBe(true);
				expect(applied.value.history?.[0]?.decisionAcknowledged).toBeUndefined();
				expect(applied.value.blocker).toContain(previous.published?.questionId);
				expect(applied.value.blocker).toContain("Historical question unavailable");
				expect(fixture.acknowledgements).toHaveLength(1);
				expect(fixture.acknowledgements[0]).toMatchObject({ disposition: "applied", responseId });
				const repeated = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", currentId, responseId))));
				expect(repeated.value.responses).toHaveLength(1);
				expect(repeated.value.responses?.[0]?.boardAcknowledged).toBe(true);
				expect(repeated.value.history?.[0]?.decisionAcknowledged).toBeUndefined();
				expect(fixture.acknowledgements).toHaveLength(1);
				expect(fixture.launched).toHaveLength(2);
			}),
	));
