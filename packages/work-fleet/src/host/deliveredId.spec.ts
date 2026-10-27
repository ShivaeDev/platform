import { Effect } from "effect";
import { expect } from "vitest";
import { previouslyMergedBranch, recentDeliveredId } from "#test/deliveredId.ts";
import { task } from "#test/fleetHost.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { noChangeHost } from "#test/hostScenarioTraits.ts";
import { approvedWork, boardWork, host } from "#test/hostStory.ts";
import { prepared } from "#test/preparation.ts";

for (const delivery of ["record", "branch"] as const) {
	host.it(
		`a new brief reusing a delivered id is invalid in Board and refused by Fleet (${delivery})`,
		[approvedWork(["one"]), delivery === "record" ? recentDeliveredId : previouslyMergedBranch],
		function* (work) {
			const original = work.readBoard("one.md");
			const before = delivery === "record" ? yield* work.get("one") : undefined;
			const failures = yield* work.admit();
			const message = `id one was delivered in ${PR}; give this brief a new id`;
			expect(failures).toContain(`one: ${message}`);
			expect(
				yield* work
					.prepare({ cwd: "/synthetic-repository", preparation: prepared(), prompt: "Implement the brief", workId: "one" })
					.pipe(Effect.flip),
			).toMatchObject({ message });
			if (delivery === "record") {
				expect(yield* work.fleetDispatch("one").pipe(Effect.flip)).toMatchObject({ message });
			}
			expect(yield* work.approve("one").pipe(Effect.flip)).toMatchObject({ message });
			const board = yield* work.boardHttp();
			const document = yield* Effect.promise(() => board.client.run(board.client.api.document.run({ url: "/one.md" })));
			expect(document.diagnostics).toContainEqual({ field: "id", line: 2, message });
			const items = yield* Effect.promise(() => board.client.run(board.client.api.fleetItems.run(undefined)));
			expect(items).toMatchObject({ completed: [], items: [], state: "ready" });
			yield* work.schedulerPass();
			expect(work.providerStarts()).toEqual([]);
			expect(work.readBoard("one.md")).toBe(original);
			if (before !== undefined) {
				expect(yield* work.get("one")).toEqual(before);
			}
		},
	);
}

host.it(
	"an existing brief dispatches again after delivery while a new source reusing its id is refused",
	[approvedWork(["one"]), noChangeHost],
	function* (work) {
		const first = yield* work.approve("one");
		work.finishTurn(first.value);
		const done = yield* work.reconcile("one");
		expect(done.step).toBe("done");
		work.writeBoard("one.md", task("one", "approved", "Follow up on the approved work."));
		const dispatched = yield* work.approve("one");
		expect(dispatched.value.step).toBe("working");
		expect(dispatched.value.history).toMatchObject([{ step: "done" }]);
		const expectedStarts = [...done.attempts, ...dispatched.value.attempts].map((attempt) => attempt.operationId);
		expect(work.providerStarts().map((entry) => entry.operationId)).toEqual(expectedStarts);
		const steers = work.providerSteers();
		work.writeBoard("one.md", task("retired"));
		const fresh = task("one", "approved", "A different brief.");
		work.writeBoard("new.md", fresh);
		expect(yield* work.approve("one").pipe(Effect.flip)).toMatchObject({ message: expect.stringContaining("give this brief a new id") });
		yield* work.schedulerPass();
		expect(work.readBoard("new.md")).toBe(fresh);
		const retained = yield* work.storedRecord("one");
		expect(retained.value.boardSourcePath).toBe(dispatched.value.boardSourcePath);
		expect(retained.value.boardContext).toBe(dispatched.value.boardContext);
		expect(work.providerSteers()).toEqual(steers);
		expect(work.providerStarts().map((entry) => entry.operationId)).toEqual(expectedStarts);
	},
);

host.it(
	"an old delivery without a dispatch for this brief cannot rewrite its identical source",
	[approvedWork(["one"]), noChangeHost],
	function* (work) {
		yield* work.admit();
		const queued = yield* work.storedRecord("one");
		yield* work.store("one", {
			...queued.value,
			outcome: { head: HEAD, revision: HEAD, url: PR },
			result: { head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR },
			step: "done",
		});
		const original = work.readBoard("one.md");
		const before = yield* work.storedRecord("one");
		const board = yield* work.boardHttp();
		const document = yield* Effect.promise(() => board.client.run(board.client.api.document.run({ url: "/one.md" })));
		expect(document.diagnostics).toContainEqual({ field: "id", line: 2, message: `id one was delivered in ${PR}; give this brief a new id` });
		expect(yield* work.approve("one").pipe(Effect.flip)).toMatchObject({ message: expect.stringContaining("give this brief a new id") });
		yield* work.reconcile("one");
		yield* work.schedulerPass();
		expect(work.readBoard("one.md")).toBe(original);
		expect(yield* work.storedRecord("one")).toEqual(before);
		expect(work.providerStarts()).toEqual([]);
	},
);

host.it(
	"a new report brief cannot reuse an id delivered by a merged PR",
	[boardWork({ "one.md": task("one", "approved").replace("kind: task", "kind: task\ndelivers: report") }), previouslyMergedBranch],
	function* (work) {
		const original = work.readBoard("one.md");
		const message = `id one was delivered in ${PR}; give this brief a new id`;
		expect(yield* work.admit()).toContain(`one: ${message}`);
		expect(yield* work.approve("one").pipe(Effect.flip)).toMatchObject({ message });
		const board = yield* work.boardHttp();
		const document = yield* Effect.promise(() => board.client.run(board.client.api.document.run({ url: "/one.md" })));
		expect(document.diagnostics).toContainEqual({ field: "id", line: 2, message });
		yield* work.schedulerPass();
		expect(work.providerStarts()).toEqual([]);
		expect(work.readBoard("one.md")).toBe(original);
	},
);
