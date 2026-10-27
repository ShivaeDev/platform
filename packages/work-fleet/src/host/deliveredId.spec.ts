import { Effect } from "effect";
import { expect } from "vitest";
import { task } from "#test/fleetHost.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { noChangeHost, previouslyMergedBranch } from "#test/hostScenarioTraits.ts";
import { approvedWork, host, storedWork } from "#test/hostStory.ts";

for (const delivery of ["record", "branch"] as const) {
	host.it(
		`a new brief reusing a delivered id is invalid in Board and refused by Fleet (${delivery})`,
		[
			approvedWork(["one"]),
			...(delivery === "record"
				? [storedWork("one", "done", { boardSourcePath: "/earlier/brief.md", result: { head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR } })]
				: [previouslyMergedBranch]),
		],
		function* (work) {
			const original = work.readBoard("one.md");
			const before = delivery === "record" ? yield* work.get("one") : undefined;
			const failures = yield* work.admit();
			const message = `id one was delivered in ${PR}; give this brief a new id`;
			expect(failures).toContain(`one: ${message}`);
			expect(yield* work.approve("one").pipe(Effect.flip)).toMatchObject({ message });
			const board = yield* work.boardHttp();
			const document = yield* Effect.promise(() => board.client.run(board.client.api.document.run({ url: "/one.md" })));
			expect(document.diagnostics).toContainEqual({ field: "id", line: 2, message });
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
		work.writeBoard("one.md", task("retired"));
		const fresh = task("one", "approved", "A different brief.");
		work.writeBoard("new.md", fresh);
		expect(yield* work.approve("one").pipe(Effect.flip)).toMatchObject({ message: expect.stringContaining("give this brief a new id") });
		yield* work.schedulerPass();
		expect(work.readBoard("new.md")).toBe(fresh);
		expect(work.providerStarts().map((entry) => entry.operationId)).toEqual(expectedStarts);
	},
);

host.it(
	"an old delivery without a dispatch for this brief cannot rewrite its identical source",
	[approvedWork(["one"]), noChangeHost],
	function* (work) {
		yield* work.admit();
		const prepared = yield* work.storedRecord("one");
		yield* work.store("one", {
			...prepared.value,
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
