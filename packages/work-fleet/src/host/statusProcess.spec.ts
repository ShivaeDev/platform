import { expect } from "@effect/vitest";
import { approvedWork, host, storedWork } from "#test/hostStory.ts";

host.it("--board loads the host file and status filters stored work as text or JSON", [approvedWork(["a", "b"])], function* (daemon) {
	yield* daemon.dispatch("a");
	yield* daemon.dispatch("b");
	const text = yield* daemon.cli(["status"]);
	expect(text.code).toBe(0);
	expect(text.stdout).toContain("Active (2)");
	expect(text.stdout).toContain("  a  executing");
	expect(text.stdout).toContain("  b  executing");
	expect(text.stdout).toContain("Waiting on maintainer (0)\nWaiting on orchestrator (0)\nWaiting on automation (0)\nCompleted (0)");
	const json = yield* daemon.cli(["status", "a", "--json"]);
	expect(json.code).toBe(0);
	expect(JSON.parse(json.stdout)).toEqual({
		active: [expect.objectContaining({ stage: "executing", workId: "a" })],
		completed: [],
		waiting: { automation: [], maintainer: [], orchestrator: [] },
	});
});

host.it(
	"a stored prepared dependency wait belongs to automation and offers no answer command",
	[
		storedWork("dependent", "prepared", {
			attentionOwner: "orchestrator",
			blocker: "waiting for dependency upstream",
		}),
	],
	function* (daemon) {
		const text = yield* daemon.cli(["status"]);
		expect(text.code).toBe(0);
		expect(text.stdout).toContain("Waiting on orchestrator (0)\nWaiting on automation (1)\n  dependent  prepared  waiting for dependency upstream");
		expect(text.stdout).not.toContain("work-fleet answer dependent");
	},
);
