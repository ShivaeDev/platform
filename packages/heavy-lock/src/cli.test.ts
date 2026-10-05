import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { afterEach, expect, it } from "vitest";
import { HOLDER_ID_ENV } from "#holder.ts";
import { cliEnvironment, HEAVY_LOCK_CLI, holdUntilReleasedOrAbandoned, runCli, type Started, start, TEST_TIMEOUT_MS, waitFor } from "#test/cli.ts";
import { holder, readLock, removeTemporaryDirectories, startTime, temporaryDirectory, temporaryLock, writeLock } from "#test/lock.ts";

afterEach(removeTemporaryDirectories);

it(
	"runs a command holding the lock, hands it the holder's id, keeps its exit code, and releases",
	async () => {
		const lock = temporaryLock();
		const holdsLock = `grep -q "\\"id\\":\\"$${HOLDER_ID_ENV}\\"" "$HEAVY_PROCESS_LOCK" && exit 3`;

		const result = await runCli(["--", "/bin/sh", "-c", holdsLock], cliEnvironment(lock));

		expect(result).toEqual({ status: 3, stderr: "" });
		expect(existsSync(lock)).toBe(false);
	},
	TEST_TIMEOUT_MS,
);

it(
	"a heavy command nested in another runs under the same lock instead of waiting for itself",
	async () => {
		const lock = temporaryLock();

		const result = await runCli(
			["--", process.execPath, "--conditions=source", HEAVY_LOCK_CLI, "--", "/bin/sh", "-c", "exit 3"],
			cliEnvironment(lock),
		);

		expect(result).toEqual({ status: 3, stderr: "" });
		expect(existsSync(lock)).toBe(false);
	},
	TEST_TIMEOUT_MS,
);

it(
	"a second heavy command waits for the first and names it",
	async () => {
		const lock = temporaryLock();
		const release = join(temporaryDirectory(), "release");
		const holding = holdUntilReleasedOrAbandoned(release);
		const runs: Started[] = [];
		try {
			const first = start(["--", ...holding], cliEnvironment(lock));
			runs.push(first);
			await waitFor(() => readLock(lock) !== undefined);
			const second = start(["--", "true"], cliEnvironment(lock));
			runs.push(second);
			await waitFor(() => second.stderr().includes("waiting for"));
			writeFileSync(release, "");
			const waited = await second.exited;

			expect((await first.exited).status).toBe(0);
			expect(waited.status).toBe(0);
			expect(waited.stderr).toContain(`waiting for pid ${first.pid} running \`${holding.join(" ")}\``);
			expect(waited.stderr).toMatch(/acquired after \d+s/u);
			expect(existsSync(lock)).toBe(false);
		} finally {
			for (const run of runs) {
				run.stop();
			}
		}
	},
	TEST_TIMEOUT_MS,
);

it(
	"records its holder in the shared protocol's format, with its process start time in the C locale",
	async () => {
		const lock = temporaryLock();
		const release = join(temporaryDirectory(), "release");
		const holding = holdUntilReleasedOrAbandoned(release);
		const run = start(["--", ...holding], cliEnvironment(lock, { LANG: "de_DE.UTF-8", LC_ALL: "de_DE.UTF-8" }), "/");
		try {
			await waitFor(() => readLock(lock) !== undefined);

			const recorded = readLock(lock) ?? "";
			const processStartedAt = startTime(run.pid);
			writeFileSync(release, "");
			const { id, startedAtMs } = JSON.parse(recorded);

			expect(recorded).toBe(
				`{"id":"${id}","pid":${run.pid},"processStartedAt":"${processStartedAt}","command":${JSON.stringify(holding.join(" "))},"cwd":"/","startedAtMs":${startedAtMs}}`,
			);
			expect((await run.exited).status).toBe(0);
		} finally {
			run.stop();
		}
	},
	TEST_TIMEOUT_MS,
);

it(
	"CI runs the command at once, even while another run holds the lock",
	async () => {
		const lock = temporaryLock();
		const typecheck = JSON.stringify(holder("typecheck"));
		writeLock(lock, typecheck);

		const result = await runCli(["--", "/bin/sh", "-c", `test -z "$${HOLDER_ID_ENV}"`], cliEnvironment(lock, { CI: "true" }));

		expect(result).toEqual({ status: 0, stderr: "" });
		expect(readLock(lock)).toBe(typecheck);
	},
	TEST_TIMEOUT_MS,
);

it.each([[[]], [["sleep", "1"]], [["--"]]])(
	"prints the usage and exits 2 for the arguments %j",
	async (args) => {
		const lock = temporaryLock();

		const result = await runCli(args, cliEnvironment(lock));

		expect(result).toEqual({ status: 2, stderr: "Usage: heavy-lock -- <command> [args...]\n" });
		expect(existsSync(lock)).toBe(false);
	},
	TEST_TIMEOUT_MS,
);

it(
	"exits 127 when the command cannot start, and releases the lock",
	async () => {
		const lock = temporaryLock();

		const result = await runCli(["--", "no-such-command-anywhere"], cliEnvironment(lock));

		expect(result.status).toBe(127);
		expect(result.stderr).toMatch(/^no-such-command-anywhere: /u);
		expect(existsSync(lock)).toBe(false);
	},
	TEST_TIMEOUT_MS,
);
