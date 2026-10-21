import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { movingMain } from "#test/hostReadPass.ts";
import { approvedWork, boardWork, host } from "#test/hostStory.ts";

for (const mode of ["admission", "dispatch", "edited dispatch"] as const) {
	host.it(
		`${mode} refreshes unlaunched preparation after main moves without archived cycles or decisions`,
		[approvedWork(["one"]), movingMain],
		function* (daemon) {
			yield* daemon.admit();
			const initial = yield* daemon.get("one");
			for (let revision = 1; revision <= (mode === "admission" ? 3 : 0); revision += 1) {
				const main = { observedAt: revision + 1, revision: `main-${revision}` };
				daemon.moveMain(main);
				expect(yield* daemon.admit()).toEqual([]);
				const record = yield* daemon.get("one");
				expect(record.preparation).toEqual({ ...initial.preparation, baseRevision: main.revision, observedAt: main.observedAt });
				expect(record.boardRevision).toBe(initial.boardRevision);
				expect(record.stageEnteredAt).toBe(initial.stageEnteredAt);
				expect(record.attempts).toEqual([]);
			}
			expect((yield* daemon.get("one")).history ?? []).toEqual([]);
			daemon.moveMain({ observedAt: 5, revision: "main-4" });
			if (mode === "edited dispatch") {
				daemon.writeBoard("one.md", task("one", "approved", "Edited criteria."));
			}
			const dispatched = (yield* daemon.approve("one")).value;
			expect(dispatched.step).toBe("working");
			expect(dispatched.decision).toBeUndefined();
			expect(dispatched.preparation.baseRevision).toBe("main-4");
			expect(dispatched.history ?? []).toEqual([]);
			expect(daemon.providerStarts()).toHaveLength(1);
		},
	);
}

const one = task("one", "approved").replace("kind: task", "kind: task\nareas: [shared]");
const two = one.replaceAll("one", "two");
for (const dispatch of ["scheduler", "explicit"] as const) {
	host.it(
		`${dispatch} picks up a queued brief moved to a free area without a decision`,
		[boardWork({ "one.md": one, "two.md": two })],
		function* (daemon) {
			yield* daemon.admit();
			yield* daemon.approve("one");
			yield* daemon.schedule();
			const waiting = yield* daemon.get("two");
			expect(waiting.step).toBe("queued");
			expect(waiting.blocker).toContain("waiting for area shared");
			const edited = task("two", "approved", "Edited criteria.")
				.replace("kind: task", "kind: task\nareas: [free]")
				.replace("fleet: approved", "fleet: approved\nfleet-launch:\n  model: edited-model");
			daemon.writeBoard("two.md", edited);
			if (dispatch === "scheduler") {
				expect(yield* daemon.admit()).toEqual([]);
				yield* daemon.schedule();
			} else {
				yield* daemon.approve("two");
			}
			const launched = yield* daemon.get("two");
			expect(launched.step).toBe("working");
			expect(launched.areas).toEqual(["free"]);
			expect(launched.boardContext).toBe(edited);
			expect(launched.prompt).toBe(edited);
			expect(launched.attempts[0]?.settings?.model).toBe("edited-model");
			expect(launched.decision).toBeUndefined();
			expect(launched.blocker).toBeUndefined();
			expect(launched.history ?? []).toEqual([]);
			expect(daemon.providerStarts()).toHaveLength(2);
		},
	);
}
