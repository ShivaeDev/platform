import { existsSync } from "node:fs";
import process from "node:process";
import { afterEach, expect, it } from "vitest";
import { HOLDER_ID_ENV } from "../src/holder.ts";
import { cliEnvironment, HEAVY_LOCK_CLI, runCli, start, waitFor } from "./support/cli.ts";
import { holder, readLock, removeTemporaryDirectories, startTime, temporaryLock, writeLock } from "./support/lock.ts";

afterEach(removeTemporaryDirectories);

const TIMEOUT = 20_000;

it(
	"runs a command holding the lock, hands it the holder's id, keeps its exit code, and releases",
	async () => {
		const lock = temporaryLock();
		const holdsLock = `grep -q "\\"id\\":\\"$${HOLDER_ID_ENV}\\"" "$HEAVY_PROCESS_LOCK" && exit 3`;

		const result = await runCli(["--", "/bin/sh", "-c", holdsLock], cliEnvironment(lock));

		expect(result).toEqual({ status: 3, stderr: "" });
		expect(existsSync(lock)).toBe(false);
	},
	TIMEOUT,
);

it(
	"a heavy command nested in another runs under the same lock instead of waiting for itself",
	async () => {
		const lock = temporaryLock();

		const result = await runCli(["--", process.execPath, HEAVY_LOCK_CLI, "--", "/bin/sh", "-c", "exit 3"], cliEnvironment(lock));

		expect(result).toEqual({ status: 3, stderr: "" });
		expect(existsSync(lock)).toBe(false);
	},
	TIMEOUT,
);

it(
	"a second heavy command waits for the first and names it",
	async () => {
		const lock = temporaryLock();
		const first = start(["--", "sleep", "1"], cliEnvironment(lock));
		await waitFor(() => readLock(lock) !== undefined);

		const second = await runCli(["--", "true"], cliEnvironment(lock));

		expect((await first.exited).status).toBe(0);
		expect(second.status).toBe(0);
		expect(second.stderr).toMatch(new RegExp(`waiting for pid ${first.pid} running \`sleep 1\``));
		expect(second.stderr).toMatch(/acquired after \d+s/);
		expect(existsSync(lock)).toBe(false);
	},
	TIMEOUT,
);

it(
	"records its holder in the shared protocol's format, with its process start time in the C locale",
	async () => {
		const lock = temporaryLock();
		const run = start(["--", "sleep", "1"], cliEnvironment(lock, { LANG: "de_DE.UTF-8", LC_ALL: "de_DE.UTF-8" }), "/");
		await waitFor(() => readLock(lock) !== undefined);

		const recorded = readLock(lock) ?? "";
		const { id, startedAtMs } = JSON.parse(recorded);

		expect(recorded).toBe(
			`{"id":"${id}","pid":${run.pid},"processStartedAt":"${startTime(run.pid)}","command":"sleep 1","cwd":"/","startedAtMs":${startedAtMs}}`,
		);
		expect((await run.exited).status).toBe(0);
	},
	TIMEOUT,
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
	TIMEOUT,
);

it.each([[[]], [["sleep", "1"]], [["--"]]])(
	"prints the usage and exits 2 for the arguments %j",
	async (args) => {
		const lock = temporaryLock();

		const result = await runCli(args, cliEnvironment(lock));

		expect(result).toEqual({ status: 2, stderr: "Usage: heavy-lock -- <command> [args...]\n" });
		expect(existsSync(lock)).toBe(false);
	},
	TIMEOUT,
);

it(
	"exits 127 when the command cannot start, and releases the lock",
	async () => {
		const lock = temporaryLock();

		const result = await runCli(["--", "no-such-command-anywhere"], cliEnvironment(lock));

		expect(result.status).toBe(127);
		expect(result.stderr).toMatch(/^no-such-command-anywhere: /);
		expect(existsSync(lock)).toBe(false);
	},
	TIMEOUT,
);
