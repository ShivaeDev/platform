import { expect } from "vitest";
import { github } from "#test/github.ts";

github.it("creates a check for a head SHA, starts it, then completes it", [], function* ({ createCheck, updateCheck, readCheck }) {
	const created = yield* createCheck({ headSha: "a".repeat(40), name: "Coverage", status: "queued" });
	expect(created).toMatchObject({ conclusion: null, detailsUrl: null, headSha: "a".repeat(40), name: "Coverage", status: "queued" });
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

github.it("sends and decodes report links when creating, starting and completing a check", [], function* ({ createCheck, updateCheck, requests }) {
	const created = yield* createCheck({ detailsUrl: "https://reports.example/queued", headSha: "c".repeat(40), name: "Coverage", status: "queued" });
	expect(created.detailsUrl).toBe("https://reports.example/queued");
	const running = yield* updateCheck(created.id, { detailsUrl: "https://reports.example/running", status: "in_progress" });
	expect(running.detailsUrl).toBe("https://reports.example/running");
	const completed = yield* updateCheck(created.id, { conclusion: "success", detailsUrl: "https://reports.example/complete", status: "completed" });
	expect(completed.detailsUrl).toBe("https://reports.example/complete");
	expect(requests().map(({ body }) => JSON.parse(body.toString()))).toEqual([
		{ "details_url": "https://reports.example/queued", "head_sha": "c".repeat(40), name: "Coverage", status: "queued" },
		{ "details_url": "https://reports.example/running", status: "in_progress" },
		{ conclusion: "success", "details_url": "https://reports.example/complete", status: "completed" },
	]);
});
