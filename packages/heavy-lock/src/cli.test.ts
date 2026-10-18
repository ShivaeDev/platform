import process from "node:process";
import { expect } from "vitest";
import { HOLDER_ID_ENV } from "#holder.ts";
import { environment, heldBy, lockStory, workingDirectory } from "#test/kit.ts";

const live = { clock: "live", timeout: 20_000 } as const;

lockStory.it(
	"commands inherit their holder's id, keep their exit code, and release",
	[],
	function* ({ cli, lock }) {
		expect(yield* cli.command(["/bin/sh", "-c", `grep -q "\\"id\\":\\"$${HOLDER_ID_ENV}\\"" "$HEAVY_PROCESS_LOCK" && exit 3`])).toEqual({
			status: 3,
			stderr: "",
		});
		expect(lock.contents()).toBeUndefined();
	},
	live,
);

lockStory.it(
	"a nested heavy command runs under the same lock",
	[],
	function* ({ cli, lock }) {
		expect(yield* cli.command([process.execPath, "--conditions=source", cli.path, "--", "/bin/sh", "-c", "exit 3"])).toEqual({
			status: 3,
			stderr: "",
		});
		expect(lock.contents()).toBeUndefined();
	},
	live,
);

lockStory.it(
	"a second command waits for the first and names it",
	[],
	function* ({ cli, lock }) {
		const first = yield* cli.start(cli.holdingCommand);
		yield* cli.waitForLock();
		const second = yield* cli.start(["true"]);
		yield* cli.waitForWaiting(second);
		yield* cli.release();
		const waited = yield* cli.exit(second);
		expect((yield* cli.exit(first)).status).toBe(0);
		expect(waited.status).toBe(0);
		expect(waited.stderr).toContain(`waiting for pid ${first.pid} running \`${cli.holdingCommand.join(" ")}\``);
		expect(waited.stderr).toMatch(/acquired after \d+s/u);
		expect(lock.contents()).toBeUndefined();
	},
	live,
);

lockStory.it(
	"the recorded holder follows the shared protocol and uses the C locale",
	[environment({ "LANG": "de_DE.UTF-8", "LC_ALL": "de_DE.UTF-8" }), workingDirectory("/")],
	function* ({ cli, lock }) {
		const child = yield* cli.start(cli.holdingCommand);
		yield* cli.waitForLock();
		const processStartedAt = cli.processStart(child);
		const recorded = lock.contents() ?? "";
		const { id, startedAtMs } = JSON.parse(recorded);
		expect(recorded).toBe(
			`{"id":"${id}","pid":${child.pid},"processStartedAt":"${processStartedAt}","command":${JSON.stringify(cli.holdingCommand.join(" "))},"cwd":"/","startedAtMs":${startedAtMs}}`,
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
		expect(yield* cli.command(["/bin/sh", "-c", `test -z "$${HOLDER_ID_ENV}"`])).toEqual({ status: 0, stderr: "" });
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
