import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { expect, it } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test";
import { prepareDatabase, protectDatabase, writeViews } from "#cliStorage.ts";
import { initialState, type State, type Work } from "#domain.ts";
import { renderViews } from "#renderViews.ts";

function work(id: string): Work {
	return {
		batchId: "batch",
		feedback: "",
		merge: "none",
		observation: null,
		outcome: null,
		phase: "queued",
		publish: "none",
		question: null,
		review: null,
		spec: {
			baseBranch: "main",
			checkout: "/tmp/widgets",
			completion: "merged",
			id,
			instructions: `Deliver ${id}`,
			repository: "example/widgets",
			requiredChecks: [],
			scope: [{ key: null, path: "src" }],
		},
		validation: null,
	};
}
const { effectApp } = makeEffectIt({ layer: NodeServices.layer, makeHarness: () => Effect.void });
it("separates delivered work and exposes concrete human questions with context and links", () => {
	const held: Work = {
		...work("blocked"),
		phase: "held",
		question: {
			context: "A new file is needed",
			link: "https://github.com/example/widgets/pull/1",
			question: "Approve scope?",
			recommendation: "Review the proposed scope",
		},
	};
	const completed: Work = {
		...work("delivered"),
		outcome: { justification: "Already satisfies the request", kind: "no-change", revision: "abc" },
		phase: "completed",
	};
	const views = renderViews({ ...initialState, works: [work("running"), held, completed] });
	expect(views.Active).toContain("## running");
	expect(views.Active).toContain("## blocked");
	expect(views.Active).not.toContain("## delivered");
	expect(views.Completed).toContain("## delivered");
	expect(views.Completed).not.toContain("## blocked");
	expect(views.NeedsHuman).toContain("Question: Approve scope?");
	expect(views.NeedsHuman).toContain("Context: A new file is needed");
	expect(views.NeedsHuman).toContain("Recommendation: Review the proposed scope");
	expect(views.NeedsHuman).toContain("https://github.com/example/widgets/pull/1");
});
it("counts reviewers as capacity and escapes untrusted markdown and HTML", () => {
	const state: State = {
		...initialState,
		attempts: [
			{
				createdAt: 1,
				feedback: "",
				id: "review-1",
				ref: { sessionId: "session", turnId: "turn" },
				result: null,
				revision: "abc",
				role: "reviewer",
				status: "running",
				workId: "unsafe",
			},
		],
		works: [{ ...work("unsafe"), spec: { ...work("unsafe").spec, instructions: "<script>bad</script> ![remote](https://example.com/image)" } }],
	};
	const views = renderViews(state);
	expect(views.Active).toContain("Capacity: 1/2");
	expect(views.Active).toContain("reviewer: running");
	expect(views.Active).not.toContain("<script>");
	expect(views.Active).not.toContain("![remote]");
});
effectApp("writes exactly the projections shown by the renderer", function* () {
	yield* Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const directory = yield* fs.makeTempDirectoryScoped();
		yield* writeViews(initialState, directory);
		const views = renderViews(initialState);
		expect(yield* fs.readFileString(path.join(directory, "Active.md"))).toBe(views.Active);
		expect(yield* fs.readFileString(path.join(directory, "Completed.md"))).toBe(views.Completed);
		expect(yield* fs.readFileString(path.join(directory, "Needs human.md"))).toBe(views.NeedsHuman);
		expect((yield* fs.readDirectory(directory)).sort()).toEqual(["Active.md", "Completed.md", "Needs human.md"]);
	}).pipe(Effect.scoped);
});
effectApp("refuses database paths inside a checkout through a symlink", function* () {
	yield* Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const directory = yield* fs.makeTempDirectoryScoped();
		const checkout = path.join(directory, "checkout");
		yield* fs.makeDirectory(checkout);
		yield* fs.symlink(checkout, path.join(directory, "alias"));
		const filename = yield* prepareDatabase(path.join(directory, "alias", "fleet.db"));
		const result = yield* protectDatabase(filename, [{ ...work("one").spec, checkout }]).pipe(Effect.result);
		expect(result._tag).toBe("Failure");
		yield* protectDatabase(path.join(directory, "fleet.db"), [{ ...work("one").spec, checkout }]);
	}).pipe(Effect.scoped);
});
