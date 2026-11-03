import { expect } from "vitest";
import { record } from "#test/storage.ts";
import { isolatedStorage, storage } from "#test/storageStory.ts";

storage.it("a terminal execution frees its execution slot for the next submission", [], function* ({ admission, advance, insert }) {
	const first = yield* insert({ ...record("board-a"), step: "submitting" }, { maxExecuting: 1 });
	expect(yield* admission({ ...record("board-b"), step: "submitting" }, { maxExecuting: 1 })).toBe("execution capacity of 1 is full");

	yield* advance(first, { step: "terminal" });

	expect(yield* admission({ ...record("board-b"), step: "submitting" }, { maxExecuting: 1 })).toBe("accepted");
});

isolatedStorage.it(
	"two submissions racing for one remaining quota admit exactly one",
	[],
	function* ({ concurrently, insert, submitAgainstQuota, workIds }) {
		const first = yield* insert(record("board-a"));
		const second = yield* insert(record("board-b"));
		const limits = { maxExecuting: 2, quota: { available: 1, observedAt: 100 } };

		const submissions = yield* concurrently(submitAgainstQuota(first, limits), submitAgainstQuota(second, limits));

		expect(submissions.toSorted((left, right) => left.localeCompare(right))).toEqual(["accepted", "quota exhausted"]);
		expect(yield* workIds("submitting")).toEqual([submissions[0] === "accepted" ? "board-a" : "board-b"]);
	},
);

storage.it(
	"a submission rechecks the current foreign backlog and stays queued when it is full",
	[],
	function* ({ advance, stepOf, insert, reserveForeign }) {
		yield* reserveForeign("pr-backlog", { backlog: true, executing: false });
		const prepared = yield* insert(record("board-a"));

		const submission = yield* advance(prepared, { step: "submitting" }, { maxBacklog: 1 });

		expect(submission).toBe("backlog capacity of 1 is full");
		expect(yield* stepOf("board-a")).toBe("queued");
	},
);
