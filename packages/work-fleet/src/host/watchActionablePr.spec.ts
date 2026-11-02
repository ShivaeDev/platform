import { expect } from "@effect/vitest";
import { HEAD, MOVED, PR } from "#test/githubResult.ts";
import { host, storedWork } from "#test/hostStory.ts";

const tracked = storedWork("one", "waiting", { attentionOwner: "automation", result: { head: HEAD, kind: "change", paths: [], pr: PR } });

for (const reason of ["failed_checks", "INTERNAL_ERROR", "TIMED_OUT"]) {
	host.it(`the default follow watch prints conflicts, ${reason} dequeues and closed PRs without auto-merge chatter`, [tracked], function* (daemon) {
		const github = yield* daemon.prApi();
		yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
		yield* github.awaitPoll();

		github.pull({ mergeable: false, "mergeable_state": "dirty" });
		yield* daemon.awaitEvent("pr-conflict");
		yield* daemon.awaitEvent("pr-stuck");
		github.pull({ "auto_merge": null });
		github.queue(false, reason);
		yield* daemon.awaitEvent("pr-dequeued");
		github.pull({ state: "closed" });
		yield* daemon.awaitEvent("pr-closed");

		expect(daemon.eventLines()).toEqual([
			expect.objectContaining({ head: HEAD, kind: "pr-conflict", pr: PR, workId: "one" }),
			expect.objectContaining({ head: HEAD, kind: "pr-stuck", pr: PR, workId: "one" }),
			expect.objectContaining({ head: HEAD, kind: "pr-dequeued", pr: PR, reason, workId: "one" }),
			expect.objectContaining({ head: HEAD, kind: "pr-closed", pr: PR, workId: "one" }),
		]);
	});
}

host.it("a routine dequeue and its auto-merge change stay quiet in the default watch", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
	yield* github.awaitPoll();
	github.pull({ "auto_merge": null });
	github.queue(false, "MANUAL");
	yield* github.awaitPoll();
	yield* github.awaitPoll();

	github.pull({ state: "closed" });
	yield* daemon.awaitEvent("pr-closed");

	expect(daemon.eventLines()).toEqual([expect.objectContaining({ kind: "pr-closed", workId: "one" })]);
});

host.it("a repeated PR conflict prints once for each observed head", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
	yield* github.awaitPoll();
	github.pull({ mergeable: false, "mergeable_state": "dirty" });
	yield* daemon.awaitEvent("pr-conflict");
	yield* daemon.awaitEvent("pr-stuck");
	github.pull({ mergeable: true, "mergeable_state": "clean" });
	yield* github.awaitPoll();
	yield* github.awaitPoll();
	github.pull({ mergeable: false, "mergeable_state": "dirty" });
	yield* github.awaitPoll();
	yield* github.awaitPoll();
	github.pull({ head: { ref: "fleet/change", sha: MOVED } });
	yield* daemon.awaitOutput("events", `"head":"${MOVED}"`);
	github.pull({ state: "closed" });
	yield* daemon.awaitEvent("pr-closed");

	expect(daemon.eventLines()).toEqual([
		expect.objectContaining({ head: HEAD, kind: "pr-conflict" }),
		expect.objectContaining({ head: HEAD, kind: "pr-stuck" }),
		expect.objectContaining({ head: MOVED, kind: "pr-conflict" }),
		expect.objectContaining({ head: MOVED, kind: "pr-stuck" }),
		expect.objectContaining({ head: MOVED, kind: "pr-closed" }),
	]);
});

for (const status of [500, 502, 503, 504]) {
	host.it(`a recovering GitHub ${status} stays quiet in the default watch`, [tracked], function* (daemon) {
		const github = yield* daemon.prApi();
		github.fail(status);
		yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
		yield* github.awaitRequests("/repos/example/repository/pulls/7", 2);

		github.pull({ state: "closed" });
		yield* daemon.awaitEvent("pr-closed");

		expect(daemon.eventLines()).toEqual([expect.objectContaining({ kind: "pr-closed", workId: "one" })]);
	});
}

host.it("--all includes merged PRs and routine queue diagnostics", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	yield* daemon.watchDefault({ all: true, apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
	yield* github.awaitPoll();
	github.fail(503);
	yield* daemon.awaitEvent("pr-error");
	github.pull({ "auto_merge": null });
	github.queue(false, "MANUAL");
	yield* daemon.awaitEvent("pr-dequeued");
	yield* daemon.awaitEvent("pr-auto-merge-off");
	github.pull({ merged: true, state: "closed" });
	yield* daemon.awaitEvent("pr-merged");

	expect(daemon.eventLines()).toEqual([
		expect.objectContaining({ kind: "pr-error", workId: "one" }),
		expect.objectContaining({ kind: "pr-dequeued", reason: "MANUAL" }),
		expect.objectContaining({ kind: "pr-auto-merge-off" }),
		expect.objectContaining({ kind: "pr-merged" }),
	]);
});

host.it("an existing PR conflict is actionable before auto-merge or queue entry", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	github.pull({ "auto_merge": null, mergeable: false, "mergeable_state": "dirty" });
	github.queue(false);

	yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
	yield* daemon.awaitEvent("pr-conflict");
	github.pull({ state: "closed" });
	yield* daemon.awaitEvent("pr-closed");

	expect(daemon.eventLines()).toEqual([
		expect.objectContaining({ head: HEAD, kind: "pr-conflict", workId: "one" }),
		expect.objectContaining({ head: HEAD, kind: "pr-closed", workId: "one" }),
	]);
});
