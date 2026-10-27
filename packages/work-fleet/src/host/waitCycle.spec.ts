import { expect } from "vitest";
import { host } from "#test/hostStory.ts";
import { waitCycle } from "#test/waitCycle.ts";

for (const kind of ["area", "merge"] as const) {
	host.it(
		`status and watch expose an existing ${kind} wait cycle and its blocked dependent, including filtered reads`,
		waitCycle(kind),
		function* (daemon) {
			const reason =
				"Stuck: wait cycle: one (https://example.invalid/pr/one) -> two (https://example.invalid/pr/two) -> one (https://example.invalid/pr/one)";
			const status = yield* daemon.cli(["status"]);
			expect(status.code).toBe(0);
			for (const id of ["one", "two", "three"]) {
				expect(status.stdout).toContain(`${id}  waiting  ${reason}`);
			}
			const filtered = yield* daemon.cli(["status", "three"]);
			expect(filtered.stdout).toContain(`three  waiting  ${reason}`);
			expect(filtered.stdout).not.toContain("  one  waiting");
			expect(status.stdout).toContain("ordinary  waiting  waiting for area work-board held by outside");
			yield* daemon.watchEvents({ events: "stuck,waiting-on-orchestrator" });
			yield* daemon.awaitEvent("stuck");
			yield* daemon.awaitOutput("events", '"workId":"two"');
			expect(daemon.eventLines()).toEqual([
				{ head: "one", kind: "stuck", pr: "https://example.invalid/pr/one", reason, workId: "one" },
				{ kind: "stuck", reason, workId: "three" },
				{ head: "two", kind: "stuck", pr: "https://example.invalid/pr/two", reason, workId: "two" },
			]);
			yield* daemon.follow("filtered", "watch", ["three"], { events: "stuck", json: true, prEvents: false });
			yield* daemon.awaitOutput("filtered", '"kind":"stuck"');
			expect(JSON.parse(daemon.followerOutput("filtered"))).toEqual({ kind: "stuck", reason, workId: "three" });
			yield* daemon.store("two", {
				...(yield* daemon.get("two")),
				attentionOwner: "automation",
				blocker: "Waiting for required checks",
				predictedConflictHold: undefined,
				stage: "waiting",
				step: "validating",
			});
			const cleared = yield* daemon.cli(["status"]);
			expect(cleared.code).toBe(0);
			expect(cleared.stdout).not.toContain("Stuck: wait cycle");
			expect(cleared.stdout).toContain("two  waiting  Waiting for required checks");
		},
	);
}
