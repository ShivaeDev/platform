import { describe, expect } from "@effect/vitest";
import { launchDefaults } from "#test/engineLaunchTraits.ts";
import { engine } from "#test/engineStory.ts";
import { reviewRequestsRepairs } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";

const defaults = { effort: "high", model: "default-model", serviceTier: "fast" };
describe("launch settings", () => {
	engine.it(
		"policy defaults reach the provider, a task override wins per field, and repair keeps them",
		[launchDefaults(defaults), reviewRequestsRepairs()],
		function* (fleet) {
			yield* fleet.prepare({
				cwd: "/synthetic",
				launch: { model: "task-model" },
				preparation: prepared({ ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
				prompt: "Implement one",
				workId: "one",
			});
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			const repair = yield* fleet.reconcile("one");
			expect(repair.value.attempts.at(-1)?.role).toBe("repair");
			const expected = { ...defaults, model: "task-model" };
			expect(fleet.providerCalls().map(({ call, settings }) => ({ call, settings }))).toEqual([
				{ call: "session", settings: expected },
				{ call: "turn", settings: expected },
				{ call: "session", settings: defaults },
				{ call: "turn", settings: defaults },
				{ call: "turn", settings: expected },
			]);
		},
	);
	engine.it("work without policy defaults or override inherits the provider defaults", [], function* (fleet) {
		yield* fleet.prepare({
			cwd: "/synthetic",
			preparation: prepared({ ownedPaths: ["src/two.ts"], sourcePaths: ["src/two.ts"] }),
			prompt: "Implement two",
			workId: "two",
		});
		yield* fleet.dispatch("two");
		expect(fleet.providerCalls().map(({ settings }) => settings)).toEqual([{}, {}]);
	});
});
