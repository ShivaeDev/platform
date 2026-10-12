import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { BoardFailure } from "#policy.ts";
import { deniedDecision } from "#test/deniedDecision.ts";
import { withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

const test = postgresTests("test");

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
