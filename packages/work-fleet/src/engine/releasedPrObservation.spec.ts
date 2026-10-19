import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest } from "#test/engineTraits.ts";
import { PR, REPORT } from "#test/githubResult.ts";

const ENDPOINT = "/repos/example/repository/pulls/7";

for (const disposition of ["released", "renewed"] as const) {
	for (const outcome of ["closed", "merged"] as const) {
		engine.it(`a ${disposition} PR is conditionally observed until it is ${outcome} and frees its area`, [githubPullRequest()], function* (fleet) {
			for (const id of ["one", "two"]) {
				fleet.setDependencies(id, []);
				fleet.setAreas(id, ["fleet/engine"]);
				yield* fleet.prepareWork(id);
			}
			yield* fleet.dispatch("one");
			fleet.workerReports(REPORT);
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
			if (disposition === "released") {
				const decision = ready.value.decision?.id ?? (yield* Effect.die("No ready decision"));
				yield* fleet.resolve("one", decision, fleet.respond(decision, "release"));
			} else {
				yield* fleet.prepareWork("one");
				expect((yield* fleet.get("one")).value.history?.[0]?.stage).toBe("needs-human");
			}
			yield* fleet.reserveForeign(PR, ["fleet/engine"]);
			expect(yield* fleet.foreignReservations()).toEqual([{ areas: ["fleet/engine"], backlog: true, executing: false, owner: PR }]);
			yield* fleet.restart();
			yield* fleet.schedule();
			expect((yield* fleet.get("two")).value.blocker).toContain(`held by ${PR}`);
			const hits = fleet.githubConditionalHits().filter((path) => path === ENDPOINT).length;
			yield* fleet.schedule();
			expect(fleet.githubConditionalHits().filter((path) => path === ENDPOINT)).toHaveLength(hits + 1);
			if (outcome === "closed") {
				fleet.closePullRequest();
			} else {
				fleet.mergePullRequest();
			}
			yield* fleet.schedule();
			expect(yield* fleet.foreignReservations()).toEqual([]);
			expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		});
	}
}

engine.it("releasing a legacy fleet-invalid closure decision does not reserve its area again", [githubPullRequest()], function* (fleet) {
	fleet.setAreas("one", ["fleet/engine"]);
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	fleet.workerReports(REPORT);
	yield* fleet.reconcile("one");
	yield* fleet.reserveForeign(PR, ["fleet/engine"]);
	fleet.closePullRequest();
	const closed = (yield* fleet.reconcile("one")).value;
	const decision = closed.decision ?? (yield* Effect.die("No closure decision"));
	expect(decision.code).toBe("pr-closed");
	yield* fleet.replaceStoredRecord({ ...closed, decision: { ...decision, code: "fleet-invalid" } });
	yield* fleet.resolve("one", decision.id, fleet.respond(decision.id, "release"));
	expect((yield* fleet.get("one")).value.stage).toBe("released");
	expect(yield* fleet.foreignReservations()).toEqual([]);
});
