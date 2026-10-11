import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { prepared } from "#test/preparation.ts";

const defaults = { effort: "high", model: "default-model", serviceTier: "fast" };
describe("launch settings", () => {
	it("policy defaults reach the provider, a task override wins per field, and repair keeps them", () =>
		withEngine({ launch: defaults, repairs: true }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* fleet.prepare({
					cwd: "/synthetic",
					launch: { model: "task-model" },
					preparation: prepared({ ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
					prompt: "Implement one",
					workId: "one",
				});
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const repair = yield* fleet.reconcile("one");
				expect(repair.value.attempts.at(-1)?.role).toBe("repair");
				const expected = { ...defaults, model: "task-model" };
				expect(fixture.settings.map(({ call, settings }) => ({ call, settings }))).toEqual([
					{ call: "session", settings: expected },
					{ call: "turn", settings: expected },
					{ call: "session", settings: defaults },
					{ call: "turn", settings: defaults },
					{ call: "turn", settings: expected },
				]);
			}),
		));
	it("work without policy defaults or override inherits the provider defaults", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* fleet.prepare({
					cwd: "/synthetic",
					preparation: prepared({ ownedPaths: ["src/two.ts"], sourcePaths: ["src/two.ts"] }),
					prompt: "Implement two",
					workId: "two",
				});
				yield* fleet.dispatch("two");
				expect(fixture.settings.map(({ settings }) => settings)).toEqual([{}, {}]);
			}),
		));
});
