import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { dependencySource } from "#test/dependencyBoard.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { answerReport } from "#test/report.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const [field, source] of [
	["status", dependencySource.replace("status: planned", "status: done")],
	["next_action", dependencySource.replace("Implement the work.", "Work completed.")],
] as const) {
	test(`target ${field} edits preserve its dependent's open decision and retry after restart`, () => {
		let blocked = false;
		const options = {
			checksQuery: (result: { readonly head: string }) => Effect.succeed({ evidence: ["Required validation"], head: result.head, passed: !blocked }),
			noChange: true,
		};
		return withFleetBoard(options, (fixture, root) =>
			Effect.gen(function* () {
				const files = boardHttpFiles(root);
				files.write("one.md", dependencySource);
				files.write(
					"dependent.md",
					"---\nid: dependent\nkind: task\nfleet: approved\nrelationships: [{ kind: depends_on, target: one }]\n---\n# Dependent\n",
				);
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				yield* prepareWork("dependent");
				yield* fleet.dispatch("dependent");
				blocked = true;
				finishWorkers(fixture);
				const waiting = yield* fleet.reconcile("dependent");
				const decision = waiting.value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing dependent decision");
				}
				files.write("one.md", source);
				const unchanged = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("dependent"))));
				expect(unchanged.value.stage).toBe("needs-human");
				expect(unchanged.value.decision).toEqual(decision);
				const answer = answerReport(root, decision.published, "retry");
				blocked = false;
				const resolved = yield* fleet.resolve("dependent", decision.id, answer);
				expect(resolved.value.stage).toBe("reviewing");
				expect(resolved.value.decision).toBeUndefined();
				expect(resolved.value.attempts).toEqual(waiting.value.attempts);
				expect((yield* fleet.reconcile("dependent")).value.stage).toBe("completed");
				expect(fixture.launched).toHaveLength(4);
			}),
		);
	});
}
