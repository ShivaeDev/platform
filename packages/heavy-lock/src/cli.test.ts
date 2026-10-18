import { Option } from "effect";
import { expect } from "vitest";
import { environment, heldBy, lockStory } from "#test/kit.ts";

const live = { clock: "live", timeout: 20_000 } as const;

lockStory.it(
	"commands inherit their holder's id, keep their exit code, and release",
	[],
	function* ({ cli, lock }) {
		expect(yield* cli.checksInheritedId()).toEqual({ status: 3, stderr: "" });
		expect(lock.contents()).toBeUndefined();
	},
	live,
);

lockStory.it(
	"a nested heavy command runs under the same lock",
	[],
	function* ({ cli, lock }) {
		expect(yield* cli.nested()).toEqual({ status: 3, stderr: "" });
		expect(lock.contents()).toBeUndefined();
	},
	live,
);

lockStory.it(
	"a second command waits for the first and names it",
	[],
	function* ({ cli, lock }) {
		const first = yield* cli.startHolding();
		const second = yield* cli.startWaiting();
		yield* cli.release();
		const waited = yield* cli.exit(second);
		expect((yield* cli.exit(first.child)).status).toBe(0);
		expect(waited.status).toBe(0);
		expect(waited.stderr).toContain(`waiting for pid ${first.child.pid} running \`${first.command}\``);
		expect(waited.stderr).toMatch(/acquired after \d+s/u);
		expect(lock.contents()).toBeUndefined();
	},
	live,
);

lockStory.it(
	"the recorded holder follows the shared protocol and uses the C locale",
	[],
	function* ({ cli, lock }) {
		const { child, command, processStartedAt } = yield* cli.startHolding();
		const recorded = lock.contents() ?? "";
		const { id, startedAtMs } = JSON.parse(recorded);
		expect(recorded).toBe(
			`{"id":"${id}","pid":${child.pid},"processStartedAt":"${Option.getOrThrow(processStartedAt)}","command":${JSON.stringify(command)},"cwd":"/","startedAtMs":${startedAtMs}}`,
		);
		yield* cli.release();
		expect((yield* cli.exit(child)).status).toBe(0);
	},
	live,
);

lockStory.it(
	"CI runs immediately while another run holds the lock",
	[heldBy("typecheck"), environment({ "CI": "true" })],
	function* ({ cli, lock }) {
		const before = lock.contents();
		expect(yield* cli.checksCi()).toEqual({ status: 0, stderr: "" });
		expect(lock.contents()).toBe(before);
	},
	live,
);

for (const args of [[], ["sleep", "1"], ["--"]]) {
	lockStory.it(
		`invalid arguments ${JSON.stringify(args)} print usage and exit 2`,
		[],
		function* ({ cli, lock }) {
			expect(yield* cli.raw(args)).toEqual({ status: 2, stderr: "Usage: heavy-lock -- <command> [args...]\n" });
			expect(lock.contents()).toBeUndefined();
		},
		live,
	);
}

lockStory.it(
	"a command that cannot start exits 127 and releases",
	[],
	function* ({ cli, lock }) {
		const result = yield* cli.command(["no-such-command-anywhere"]);
		expect(result.status).toBe(127);
		expect(result.stderr).toMatch(/^no-such-command-anywhere: /u);
		expect(lock.contents()).toBeUndefined();
	},
	live,
);
