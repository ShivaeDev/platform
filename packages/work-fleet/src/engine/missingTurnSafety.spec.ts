import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

for (const reason of ["unavailable", "protocol", "ambiguous"] as const) {
	postgresTests("test")(`uncertain ${reason} evidence cannot authorize automatic or explicit release by its wording`, () =>
		withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					observe: () =>
						Effect.fail(new SessionFailure({ message: "No matching accepted turn is observable; absence does not authorize replay", reason })),
				}),
			},
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					const waiting = yield* fleet.reconcile("one");
					expect(waiting.value.step).toBe("waiting");
					fixture.boardStatus("one", "done");
					expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
					const decisionId = waiting.value.decision?.id ?? "missing";
					expect((yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "release")).pipe(Effect.result))._tag).toBe("Failure");
					expect(executing((yield* fleet.get("one")).value)).toBe(true);
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
				}),
		),
	);
}
