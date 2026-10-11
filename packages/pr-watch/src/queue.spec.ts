import { Effect } from "effect";
import { expect } from "vitest";
import { effectApp } from "#test/services.ts";
import { Watcher } from "#Watcher.ts";

const refs = [{ ref: "refs/heads/gh-readonly-queue/main/pr-1-abc" }];
effectApp("a queue rebuild retains membership until the PR confirms a drop", function* (h) {
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	yield* h.cycle;
	expect(h.requests.some((request) => request.path === "/graphql")).toBe(false);
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setQueue(1, true, false);
	expect((yield* h.cycle).prs["1"]?.queued).toBe(true);
	yield* h.restart;
	expect(h.lines).toEqual([]);
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setPull(1, { "auto_merge": null });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["dequeued", "auto-merge-off"]);
	const confirmations = h.requests.filter((request) => request.path === "/graphql");
	expect(confirmations).toHaveLength(3);
	expect(confirmations.every((request) => request.method === "POST" && request.etag === undefined)).toBe(true);
	expect(confirmations[0]?.body).toMatchObject({ variables: { name: "project", number: 1, owner: "acme" } });
	expect(confirmations[0]?.authorization).toBe("Bearer test-token");
	yield* h.cycle;
	yield* h.restart;
	expect(h.lines).toHaveLength(2);
});
effectApp("the PR queue entry prevents a false drop even when auto-merge is disabled", function* (h) {
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setPull(1, { "auto_merge": null });
	h.setQueue(1, false, true);
	expect((yield* h.cycle).prs["1"]?.queued).toBe(true);
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["auto-merge-off"]);
	h.setQueue(1, false, false);
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["auto-merge-off", "dequeued"]);
});
effectApp.each([
	{ body: {}, status: 500 },
	{ body: { data: null, errors: [{ message: "Unavailable" }] } },
	{ body: { data: { repository: { pullRequest: null } } } },
	{ body: { data: { repository: { pullRequest: { autoMergeRequest: null, mergeQueueEntry: null, state: "CLOSED" } } } } },
	{ body: { data: { repository: { pullRequest: { autoMergeRequest: null, mergeQueueEntry: null, state: "OPEN" } } }, errors: [{}] } },
])("failed or incomplete queue confirmation retains the successful snapshot: $item", function* (reply, h) {
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setPull(1, { "auto_merge": null });
	h.setGraphql(reply);
	const result = yield* Effect.result(h.cycle);
	expect(result._tag).toBe("Failure");
	const watcher = yield* Watcher;
	expect((yield* watcher.load(h.options)).prs["1"]).toMatchObject({ autoMerge: true, queued: true });
	expect(h.lines).toEqual([]);
});
effectApp("terminal PRs need no queue confirmation", function* (h) {
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setPull(1, { merged: true, state: "closed" });
	h.setGraphql({ body: {}, status: 500 });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["merged"]);
	expect(h.requests.some((request) => request.path === "/graphql")).toBe(false);
});

effectApp("Enterprise REST bases use the matching GraphQL endpoint", function* (h) {
	h.options.apiUrl = `${h.options.apiUrl}/api/v3`;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setPull(1, { "auto_merge": null });
	yield* h.cycle;
	expect(h.requests.some((request) => request.path === "/api/graphql")).toBe(true);
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["dequeued", "auto-merge-off"]);
});
