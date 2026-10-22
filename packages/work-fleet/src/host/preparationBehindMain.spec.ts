import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { movingMain } from "#test/hostReadPass.ts";
import { approvedWork, boardWork, host, localOnlyBoard } from "#test/hostStory.ts";

host.it(
	"an approved task whose preparation main left behind between admission and dispatch launches without a decision",
	[approvedWork(["one"]), movingMain],
	function* (daemon) {
		yield* daemon.admit();
		const admitted = yield* daemon.get("one");
		expect(admitted).toMatchObject({ preparation: { baseRevision: "main-0", contextComplete: false, ownedPaths: ["."] }, step: "queued" });
		daemon.moveMain({ observedAt: 2, revision: "main-1" });
		yield* daemon.schedule();
		const launched = yield* daemon.get("one");
		expect(launched.decision).toBeUndefined();
		expect(launched.step).toBe("working");
		expect(launched.preparation).toEqual({ ...admitted.preparation, baseRevision: "main-1", observedAt: 2 });
		expect(daemon.providerStarts()).toEqual([expect.objectContaining({ prompt: launched.prompt })]);
	},
);

for (const mode of ["scheduler", "dispatch"] as const) {
	host.it(
		`${mode} prepares a task that an earlier dispatch stopped behind main again and launches it`,
		[approvedWork(["one"]), movingMain],
		function* (daemon) {
			yield* daemon.admit();
			const admitted = yield* daemon.get("one");
			yield* daemon.store("one", { ...admitted, preparation: { ...admitted.preparation, ownedPaths: ["src/one.ts"] } });
			daemon.moveMain({ observedAt: 2, revision: "main-1" });
			const scoped = (yield* daemon.fleetDispatch("one")).value;
			expect(scoped).toMatchObject({ attempts: [], decision: { code: "incomplete-context", reason: "incomplete-context" }, step: "waiting" });
			expect(scoped.decision?.published).toBeDefined();
			yield* daemon.store("one", { ...scoped, preparation: admitted.preparation });
			daemon.moveMain({ observedAt: 3, revision: "main-2" });
			if (mode === "scheduler") {
				expect(yield* daemon.admit()).toEqual([]);
				const reprepared = yield* daemon.get("one");
				expect(reprepared.decision).toBeUndefined();
				expect(reprepared).toMatchObject({ preparation: { baseRevision: "main-2", ownedPaths: ["."] }, step: "queued" });
				expect(reprepared.history).toMatchObject([{ decision: { code: "incomplete-context" }, step: "waiting" }]);
				yield* daemon.schedule();
			} else {
				yield* daemon.approve("one");
			}
			const launched = yield* daemon.get("one");
			expect(launched.decision).toBeUndefined();
			expect(launched.step).toBe("working");
			expect(launched.preparation.baseRevision).toBe("main-2");
			expect(daemon.providerStarts()).toEqual([expect.objectContaining({ prompt: launched.prompt })]);
		},
	);
}

const localOnly = task("one", "approved").replace(
	"kind: task",
	"kind: task\ncriteria:\n  - id: evidence\n    text: Measure documents in private/board/notes.",
);

host.it(
	"a local-only criterion still asks after main left the preparation behind, and admission keeps the question",
	[boardWork({ "one.md": localOnly }, { provider: "cloud" }), localOnlyBoard, movingMain],
	function* (daemon) {
		expect(yield* daemon.admit()).toEqual([]);
		daemon.moveMain({ observedAt: 2, revision: "main-1" });
		yield* daemon.schedule();
		const blocked = yield* daemon.get("one");
		expect(blocked).toMatchObject({ attempts: [], decision: { code: "incomplete-context" }, step: "waiting" });
		expect(blocked.decision?.reason).toContain("Cloud workers cannot read local-only Board data");
		daemon.moveMain({ observedAt: 3, revision: "main-2" });
		expect(yield* daemon.admit()).toEqual([]);
		expect((yield* daemon.get("one")).decision).toEqual(blocked.decision);
		expect(daemon.providerStarts()).toEqual([]);
	},
);
