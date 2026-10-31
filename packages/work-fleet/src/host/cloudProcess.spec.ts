import { expect } from "@effect/vitest";
import { host } from "#test/hostStory.ts";

host.it("interrupting the wait on a spawned host closes it as an interruption", [], function* (daemon) {
	const waited = yield* daemon.interruptHostWait();

	expect(waited).toBe("interrupted");
});

host.it(
	"a failed host startup reports its exit status and stderr before the progress deadline, and its kill reports the missing exit with stderr",
	[],
	function* (daemon) {
		const startup = yield* daemon.invalidHostStartup();

		expect(startup).toEqual({
			kill: expect.stringMatching(/Host did not exit from SIGKILL[\s\S]*Host stderr:/u),
			startup: expect.stringMatching(/exited \(code 1, signal null\)[\s\S]*Host stderr:[\s\S]*Fleet host configuration[\s\S]*is invalid/u),
			timing: "before the progress deadline",
		});
		expect(startup.startup).not.toContain("Restart progress stalled");
	},
);
