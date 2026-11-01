import { expect } from "@effect/vitest";
import { HEAD, PR } from "#test/githubResult.ts";
import { host, storedWork } from "#test/hostStory.ts";

const RELEASE_PR = "https://github.com/example/repository/pull/8";

host.it(
	"the watch reports a held release PR's queue removal with its reason",
	[
		storedWork("one", "waiting", {
			attentionOwner: "automation",
			blocker: "Waiting for release PR #8 to merge",
			releaseWindow: { observedAt: 100, pr: RELEASE_PR, progress: "release-head" },
			result: { head: HEAD, kind: "change", pr: PR },
		}),
	],
	function* (daemon) {
		const github = yield* daemon.prApi();
		github.pull({ head: { ref: "release/next", sha: HEAD }, title: "Release next" }, 8);
		github.queue(true, "", 8);
		yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
		yield* github.awaitRequests("/repos/example/repository/pulls/8", 2);
		github.pull({ "auto_merge": null }, 8);
		github.queue(false, "failed_checks", 8);
		yield* daemon.awaitEvent("pr-dequeued");
		expect(daemon.eventLines()).toContainEqual(
			expect.objectContaining({
				kind: "pr-dequeued",
				number: 8,
				pr: RELEASE_PR,
				reason: "failed_checks",
				repository: "example/repository",
				workId: "one",
			}),
		);
	},
);
