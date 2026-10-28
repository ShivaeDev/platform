import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { enterprise, hasPull, queuedPulls } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const autoMerge of [true, false]) {
	watch.it(
		`entering the queue emits queued when auto-merge was ${autoMerge}`,
		[hasPull(1, { "auto_merge": autoMerge ? { "merge_method": "squash" } : null })],
		function* (h) {
			yield* h.poll;
			h.pullIs(1, { "auto_merge": null });
			h.queueHas(1);
			expect((yield* h.poll).prs["1"]).toMatchObject({ autoMerge: false, queued: true });
			expect(h.events()).toEqual([{ branch: "feature-1", event: "queued", number: 1, title: "Change 1" }]);
			yield* h.poll;
			yield* h.restart;
			expect(h.eventNames()).toEqual(["queued"]);
			h.queueHas();
			yield* h.poll;
			expect(h.eventNames()).toEqual(["queued", "dequeued", "auto-merge-off"]);
			yield* h.restart;
			expect(h.eventNames()).toEqual(["queued", "dequeued", "auto-merge-off"]);
		},
	);
}
watch.it(
	"startup establishes queued membership without emitting an entry",
	[queuedPulls(1), hasPull(1, { mergeable: false, "mergeable_state": "dirty" })],
	function* (h) {
		yield* h.poll;
		expect(h.eventNames()).toEqual(["conflict", "stuck"]);
	},
);
watch.it("a queue rebuild retains membership until the PR confirms a drop", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	expect(h.requests.some((request) => request.path === "/graphql")).toBe(false);
	h.queueHas();
	h.queueEntryIs(1, true, false);
	expect((yield* h.poll).prs["1"]?.queued).toBe(true);
	yield* h.restart;
	expect(h.lines).toEqual([]);
	h.queueHas(1);
	yield* h.poll;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	yield* h.poll;
	expect(h.eventNames()).toEqual(["dequeued", "auto-merge-off"]);
	const confirmations = h.requests.filter((request) => request.path === "/graphql");
	expect(confirmations).toMatchObject([
		{ authorization: "Bearer test-token", body: { variables: { name: "project", number: 1, owner: "acme" } }, etag: undefined, method: "POST" },
		{ etag: undefined, method: "POST" },
		{ etag: undefined, method: "POST" },
	]);
	yield* h.poll;
	yield* h.restart;
	expect(h.eventNames()).toEqual(["dequeued", "auto-merge-off"]);
});
watch.it("the PR queue entry prevents a false drop even when auto-merge is disabled", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	h.queueEntryIs(1, false, true);
	expect((yield* h.poll).prs["1"]?.queued).toBe(true);
	expect(h.lines).toEqual([]);
	h.queueEntryIs(1, false, false);
	yield* h.poll;
	expect(h.eventNames()).toEqual(["dequeued", "auto-merge-off"]);
});
watch.it("a dequeued PR reports GitHub's failed_checks reason", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	h.queueEntryIs(1, false, false, "failed_checks");
	yield* h.poll;
	expect(h.events()).toEqual([
		{ branch: "feature-1", event: "dequeued", number: 1, reason: "failed_checks", title: "Change 1" },
		{ branch: "feature-1", event: "auto-merge-off", number: 1, title: "Change 1" },
	]);
});
for (const data of [undefined, null, { repository: null }]) {
	watch.it(`GraphQL errors explain a failed queue confirmation with data=${JSON.stringify(data)}`, [queuedPulls(1)], function* (h) {
		yield* h.poll;
		h.queueHas();
		h.queueConfirmationIs({
			body: { ...(data === undefined ? {} : { data }), errors: [{ message: "No such type DequeuedEvent, so it can't be a fragment condition" }] },
		});
		expect((yield* Effect.result(h.poll))._tag).toBe("Failure");
		expect(h.diagnostics).toEqual(["GitHub queue confirmation: No such type DequeuedEvent, so it can't be a fragment condition"]);
		expect((yield* h.saved()).prs["1"]).toMatchObject({ queued: true });
		expect(h.lines).toEqual([]);
	});
}
const confirmations = [
	{ body: {}, status: HttpStatus.fromLiteral("InternalServerError") },
	{ body: { data: null, errors: [{ message: "Unavailable" }] } },
	{ body: { data: { repository: { pullRequest: null } } } },
	{ body: { data: { repository: { pullRequest: { autoMergeRequest: null, mergeQueueEntry: null, state: "CLOSED" } } } } },
	{
		body: {
			data: { repository: { pullRequest: { autoMergeRequest: null, mergeQueueEntry: null, state: "OPEN", timelineItems: { nodes: [] } } } },
			errors: [{ message: "Unavailable" }],
		},
	},
];
for (const [index, reply] of confirmations.entries()) {
	watch.it(`failed or incomplete queue confirmation retains the successful snapshot: case ${index + 1}`, [queuedPulls(1)], function* (h) {
		yield* h.poll;
		h.queueHas();
		h.pullIs(1, { "auto_merge": null });
		h.queueConfirmationIs(reply);
		const result = yield* Effect.result(h.poll);
		expect(result._tag).toBe("Failure");
		expect((yield* h.saved()).prs["1"]).toMatchObject({ autoMerge: true, queued: true });
		expect(h.lines).toEqual([]);
	});
}
watch.it("terminal PRs need no queue confirmation", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.queueHas();
	h.merged(1);
	h.queueConfirmationIs({ body: {}, status: HttpStatus.fromLiteral("InternalServerError") });
	yield* h.poll;
	expect(h.eventNames()).toEqual(["merged"]);
	expect(h.requests.some((request) => request.path === "/graphql")).toBe(false);
});

watch.it("Enterprise REST bases use the matching GraphQL endpoint", [enterprise(), queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	yield* h.poll;
	expect(h.requests.some((request) => request.path === "/api/graphql")).toBe(true);
	expect(h.eventNames()).toEqual(["dequeued", "auto-merge-off"]);
});
