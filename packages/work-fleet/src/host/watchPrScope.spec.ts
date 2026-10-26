import { expect } from "@effect/vitest";
import { HEAD, PR } from "#test/githubResult.ts";
import { host, storedWork } from "#test/hostStory.ts";

const SECOND_PR = "https://github.com/example/repository/pull/8";
const LIST_PATH = "/repos/example/repository/pulls?state=open&per_page=100";

for (const terminal of ["merged", "closed"] as const) {
	host.it(
		`the watch leaves finished PRs in history and follows an open PR until it is ${terminal}`,
		[
			storedWork("finished", "done", { result: { head: HEAD, kind: "change", pr: PR } }),
			storedWork("open", "waiting", { result: { head: HEAD, kind: "change", pr: SECOND_PR } }),
			storedWork("stale", "waiting", { result: { head: HEAD, kind: "change", pr: "https://github.com/example/repository/pull/9" } }),
		],
		function* (daemon) {
			const github = yield* daemon.prApi();
			github.pull({ merged: true, state: "closed" });
			github.pull({ merged: false, state: "open" }, 8);
			github.pull({ merged: true, state: "closed" }, 9);
			yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
			yield* github.awaitPoll();
			yield* github.awaitPoll();
			expect(github.requests()).not.toContainEqual(expect.objectContaining({ path: "/repos/example/repository/pulls/7" }));
			expect(github.requests()).not.toContainEqual(expect.objectContaining({ path: "/repos/example/repository/pulls/9" }));
			github.pull({ merged: terminal === "merged", state: "closed" }, 8);
			yield* daemon.awaitEvent(`pr-${terminal}`);
			const terminalReads = github.requests().filter(({ path }) => path === "/repos/example/repository/pulls/8");
			const rounds = github.requests().filter(({ path }) => path === LIST_PATH).length;
			yield* github.awaitRequests(LIST_PATH, rounds + 3);
			expect(github.requests().filter(({ path }) => /\/pulls\/[789]$/u.test(path))).toEqual(terminalReads);
			expect(terminalReads.length).toBeGreaterThanOrEqual(3);
			expect(daemon.eventLines()).toContainEqual(expect.objectContaining({ kind: `pr-${terminal}`, number: 8, pr: SECOND_PR, workId: "open" }));
			expect(daemon.eventLines()).not.toContainEqual(expect.objectContaining({ kind: "pr-error" }));
			expect(daemon.watchRunning()).toBe(true);
		},
	);
}

host.it(
	"a PR refused with 422 reports once and backs off while other PRs keep reporting",
	[
		storedWork("huge", "waiting", { result: { head: HEAD, kind: "change", pr: PR } }),
		storedWork("open", "waiting", { result: { head: HEAD, kind: "change", pr: SECOND_PR } }),
	],
	function* (daemon) {
		const github = yield* daemon.prApi();
		github.pull({}, 8);
		github.fail(422);
		yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
		yield* daemon.awaitEvent("pr-error");
		yield* github.awaitPoll();
		yield* github.awaitPoll();
		github.pull({ mergeable: false, "mergeable_state": "dirty" }, 8);
		yield* daemon.awaitEvent("pr-conflict");
		github.pull({ state: "closed" }, 8);
		yield* daemon.awaitEvent("pr-closed");
		expect(github.requests().filter(({ path }) => path === "/repos/example/repository/pulls/7")).toEqual([
			{ path: "/repos/example/repository/pulls/7", status: 422 },
		]);
		expect(daemon.eventLines().filter((line) => typeof line === "object" && line !== null && "kind" in line && line.kind === "pr-error")).toEqual([
			expect.objectContaining({ kind: "pr-error", message: expect.stringContaining("422"), number: 7, pr: PR, workId: "huge" }),
		]);
		expect(daemon.eventLines()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "pr-conflict", number: 8, workId: "open" }),
				expect.objectContaining({ kind: "pr-closed", number: 8, workId: "open" }),
			]),
		);
		expect(daemon.eventLines()).not.toContainEqual(expect.objectContaining({ kind: "pr-stopped" }));
		expect(daemon.watchRunning()).toBe(true);
	},
);
