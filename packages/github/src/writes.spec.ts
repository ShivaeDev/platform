import { expect } from "vitest";
import { github } from "#test/github.ts";

github.it("creates a check for a head SHA, starts it, then completes it", [], function* ({ createCheck, updateCheck, readCheck }) {
	const created = yield* createCheck({ headSha: "a".repeat(40), name: "Coverage", status: "queued" });
	expect(created).toMatchObject({ conclusion: null, headSha: "a".repeat(40), name: "Coverage", status: "queued" });
	yield* updateCheck(created.id, { output: { summary: "Measuring", title: "Coverage" }, status: "in_progress" });
	expect(yield* readCheck(created.id)).toMatchObject({ output: { summary: "Measuring" }, status: "in_progress" });
	yield* updateCheck(created.id, {
		conclusion: "success",
		output: { summary: "90% covered", text: "All targets measured", title: "Coverage" },
		status: "completed",
	});
	expect(yield* readCheck(created.id)).toMatchObject({
		conclusion: "success",
		id: created.id,
		output: { summary: "90% covered", text: "All targets measured", title: "Coverage" },
		status: "completed",
	});
});

github.it("creates a running check with output", [], function* ({ createCheck, readCheck }) {
	const created = yield* createCheck({
		headSha: "b".repeat(40),
		name: "Coverage",
		output: { summary: "Measuring", text: "Targets selected", title: "Coverage" },
		status: "in_progress",
	});
	expect(yield* readCheck(created.id)).toMatchObject({
		headSha: "b".repeat(40),
		output: { summary: "Measuring", text: "Targets selected", title: "Coverage" },
		status: "in_progress",
	});
});
