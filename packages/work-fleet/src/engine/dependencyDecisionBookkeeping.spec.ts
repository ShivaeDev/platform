import { Effect } from "effect";
import { expect } from "vitest";
import { dependencySource } from "#test/dependencyBoard.ts";
import { dependentValidation } from "#test/dependentValidation.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const [field, source] of [
	["status", dependencySource.replace("status: draft", "status: done")],
	["next_action", dependencySource.replace("Implement the work.", "Work completed.")],
] as const) {
	{
		let blocked = false;
		const options = {
			checksQuery: (result: { readonly head: string }) => Effect.succeed({ evidence: ["Required validation"], head: result.head, passed: !blocked }),
			noChange: true,
		};
		const dependentValidationTrait = engineConfiguration("dependent validation", dependentValidation({ options: () => options }));
		engine.it(
			`target ${field} edits preserve its dependent's open decision and retry after restart`,
			[markdownWork(), dependentValidationTrait],
			function* ({ writeBoardWork, answerReport, launches, finishWorkers, prepareWork, restart, fleet }) {
				writeBoardWork("one.md", dependencySource);
				writeBoardWork(
					"dependent.md",
					"---\nid: dependent\nkind: task\nfleet: approved\nrelationships: [{ kind: depends_on, target: one }]\n---\n# Dependent\n",
				);
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
				yield* prepareWork("dependent");
				yield* fleet.dispatch("dependent");
				blocked = true;
				finishWorkers();
				const waiting = yield* fleet.reconcile("dependent");
				const decision = waiting.value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing dependent decision");
				}
				writeBoardWork("one.md", source);
				yield* restart();
				const unchanged = yield* fleet.reconcile("dependent");
				expect(unchanged.value.step).toBe("waiting");
				expect(unchanged.value.decision).toEqual(decision);
				const answer = answerReport(decision.published, "retry");
				blocked = false;
				const resolved = yield* fleet.resolve("dependent", decision.id, answer);
				expect(resolved.value.step).toBe("reviewing");
				expect(resolved.value.decision).toBeUndefined();
				expect(resolved.value.attempts).toEqual(waiting.value.attempts);
				expect((yield* fleet.reconcile("dependent")).value.step).toBe("done");
				expect(launches()).toEqual(["operation-1", "operation-2", "operation-3", "operation-4"]);
			},
		);
	}
}
