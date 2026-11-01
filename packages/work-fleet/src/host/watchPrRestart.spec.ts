import { expect } from "@effect/vitest";
import * as HttpStatus from "effect/http/HttpStatus";
import { HEAD, PR } from "#test/githubResult.ts";
import { host, storedWork } from "#test/hostStory.ts";

const REPOSITORY = "example/repository";
const LIST_PATH = `/repos/${REPOSITORY}/pulls?state=open&per_page=100`;
const tracked = storedWork("one", "waiting", { result: { head: HEAD, kind: "change", pr: PR } });

for (const terminal of ["merged", "closed"] as const) {
	for (const observed of [false, true]) {
		host.it(
			`a tracked PR ${terminal} during downtime is recorded on restart with ${observed ? "a saved" : "no"} baseline`,
			[tracked],
			function* (daemon) {
				const github = yield* daemon.prApi();
				const settings = { apiUrl: github.url, prEvents: true, prInterval: 0.1 };
				if (observed) {
					yield* daemon.watchEvents(settings);
					yield* github.awaitPoll();
					yield* github.awaitPoll();
					yield* daemon.stopWatch();
				}
				yield* daemon.stop();
				github.pull({ merged: terminal === "merged", state: "closed" });
				yield* daemon.start();
				yield* daemon.watchEvents(settings);
				yield* daemon.awaitEvent(`pr-${terminal}`);
				yield* daemon.stopWatch();
				expect(daemon.eventLines()).toContainEqual(expect.objectContaining({ kind: `pr-${terminal}`, number: 7, pr: PR, workId: "one" }));
				expect((yield* daemon.prWatchState(REPOSITORY)).prs["7"]).toMatchObject({ merged: terminal === "merged", state: "closed" });
				const reads = github.requests().filter(({ path }) => path.endsWith("/pulls/7"));
				const rounds = github.requests().filter(({ path }) => path === LIST_PATH).length;
				yield* daemon.watchEvents(settings);
				yield* github.awaitRequests(LIST_PATH, rounds + 2);
				yield* daemon.stopWatch();
				expect(daemon.eventLines()).not.toContainEqual(expect.objectContaining({ kind: `pr-${terminal}` }));
				expect(github.requests().filter(({ path }) => path.endsWith("/pulls/7"))).toEqual(reads);
			},
		);
	}
}

host.it("an open tracked PR remains watched after restart", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	const settings = { apiUrl: github.url, prEvents: true, prInterval: 0.1 };
	yield* daemon.watchEvents(settings);
	yield* github.awaitPoll();
	yield* github.awaitPoll();
	yield* daemon.stopWatch();
	yield* daemon.stop();
	yield* daemon.start();
	yield* daemon.watchEvents(settings);
	yield* github.awaitPoll();
	github.pull({ mergeable: false, "mergeable_state": "dirty" });
	yield* daemon.awaitEvent("pr-conflict");
	expect(daemon.eventLines()).toContainEqual(expect.objectContaining({ kind: "pr-conflict", number: 7, workId: "one" }));
	expect(daemon.watchRunning()).toBe(true);
});

host.it("a failed queue confirmation leaves the saved snapshot and transitions unconfirmed until GitHub recovers", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
	yield* github.awaitPoll();
	yield* github.awaitPoll();
	const before = yield* daemon.prWatchState(REPOSITORY);
	github.pull({ "auto_merge": null, mergeable: false, "mergeable_state": "dirty" });
	github.queue(false, "failed_checks");
	github.failQueue(HttpStatus.fromLiteral("ServiceUnavailable"));
	yield* daemon.awaitEvent("pr-error");
	yield* github.awaitRequests("/graphql", 2);
	expect(yield* daemon.prWatchState(REPOSITORY)).toEqual(before);
	for (const kind of ["pr-dequeued", "pr-auto-merge-off", "pr-conflict", "pr-stuck"]) {
		expect(daemon.eventLines()).not.toContainEqual(expect.objectContaining({ kind }));
	}
	github.queue(false, "failed_checks");
	yield* daemon.awaitEvent("pr-dequeued");
	yield* daemon.awaitEvent("pr-conflict");
	expect(daemon.eventLines()).toContainEqual(expect.objectContaining({ kind: "pr-dequeued", reason: "failed_checks", workId: "one" }));
	expect(daemon.watchRunning()).toBe(true);
});
