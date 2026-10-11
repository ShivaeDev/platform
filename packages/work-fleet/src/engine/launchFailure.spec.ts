import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("launch failure ownership", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("provider unavailability after session acknowledgement keeps retries on the existing attempt", () =>
		withEngine({ unavailableTurn: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const failed = yield* fleet.dispatch("one");
				expect(failed.value.stage).toBe("needs-human");
				expect(failed.value.attempts[0]).toMatchObject({ sessionId: "session-operation-1", status: "submitting" });
				const decisionId = failed.value.decision?.id ?? "missing";
				yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry"));
				const recovered = yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						yield* restarted.dispatch("one");
						return yield* restarted.reconcile("one");
					}),
				);
				expect(recovered.value.stage).toBe("needs-human");
				expect(recovered.value.attempts).toEqual(failed.value.attempts);
				expect(fixture.launched).toEqual(["operation-1"]);
			}),
		));
});
