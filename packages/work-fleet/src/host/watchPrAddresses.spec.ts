import { expect } from "@effect/vitest";
import { HEAD } from "#test/githubResult.ts";
import { host, storedWork } from "#test/hostStory.ts";

const invalid = [
	"https://example.org/example/repository/pull/7",
	"https://github.com/example/repository/pull/0",
	"https://github.com/example/repository/pull/01",
	"https://github.com/example/repository/pull/-1",
	"https://github.com/example/repository/pull/1.5",
	"https://github.com/example/repository/pull/9007199254740993",
];

host.it(
	"the watch ignores unsupported hosts and invalid PR numbers while following a GitHub PR",
	[
		...invalid.map((pr, index) => storedWork(`invalid-${index}`, "waiting", { result: { head: HEAD, kind: "change", pr } })),
		storedWork("valid", "waiting", { result: { head: HEAD, kind: "change", pr: "https://github.com/example/repository/pull/8" } }),
	],
	function* (daemon) {
		const github = yield* daemon.prApi();
		github.pull({}, 8);
		yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
		yield* github.awaitPoll();
		yield* github.awaitPoll();

		const reads = github.requests().filter(({ path }) => path.startsWith("/repos/example/repository/pulls/"));
		expect(reads.length).toBeGreaterThan(0);
		expect(reads.every(({ path }) => path === "/repos/example/repository/pulls/8")).toBe(true);
		expect(daemon.eventLines()).not.toContainEqual(expect.objectContaining({ kind: "pr-error" }));
	},
);
