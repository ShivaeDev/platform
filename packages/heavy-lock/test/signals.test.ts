import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { afterEach, expect, it } from "vitest";
import { cliEnvironment, pollWhile, runCli, start, TEST_TIMEOUT_MS, waitFor } from "#test/support/cli.ts";
import { holder, lockDirectory, readLock, removeTemporaryDirectories, temporaryDirectory, temporaryLock, writeLock } from "#test/support/lock.ts";

afterEach(removeTemporaryDirectories);

const trapping = (ready: string) =>
	`trap "exit 10" INT; trap "exit 11" TERM; trap "exit 12" HUP; touch "${ready}"; ${pollWhile(`[ -d "${dirname(ready)}" ]`)}; exit 1`;

it.each([
	["SIGINT", 10],
	["SIGTERM", 11],
	["SIGHUP", 12],
] as const)(
	"forwards %s to the command, exits with the command's code, and releases the lock",
	async (signal, code) => {
		const lock = temporaryLock();
		const ready = join(temporaryDirectory(), "ready");
		const run = start(["--", "/bin/sh", "-c", trapping(ready)], cliEnvironment(lock));
		try {
			await waitFor(() => existsSync(ready));

			process.kill(run.pid, signal);

			expect((await run.exited).status).toBe(code);
			expect(existsSync(lock)).toBe(false);
		} finally {
			run.stop();
		}
	},
	TEST_TIMEOUT_MS,
);

it(
	"runs the command as the leader of its own process group",
	async () => {
		const lock = temporaryLock();

		const result = await runCli(["--", "/bin/sh", "-c", 'test "$(ps -o pgid= -p $$ | tr -d " ")" = "$$"'], cliEnvironment(lock));

		expect(result).toEqual({ status: 0, stderr: "" });
	},
	TEST_TIMEOUT_MS,
);

it(
	"exits with the conventional code when the command dies of a signal",
	async () => {
		const lock = temporaryLock();
		const ready = join(temporaryDirectory(), "ready");
		const run = start(["--", "/bin/sh", "-c", `touch "${ready}"; exec sleep 10`], cliEnvironment(lock));
		try {
			await waitFor(() => existsSync(ready));
			process.kill(run.pid, "SIGINT");
			expect((await run.exited).status).toBe(130);
		} finally {
			run.stop();
		}

		const killed = await runCli(["--", "/bin/sh", "-c", "kill -KILL $$"], cliEnvironment(lock));

		expect(killed.status).toBe(137);
		expect(existsSync(lock)).toBe(false);
	},
	TEST_TIMEOUT_MS,
);

it(
	"a signal while waiting abandons the wait and leaves the holder's lock alone",
	async () => {
		const lock = temporaryLock();
		const build = JSON.stringify(holder("build"));
		writeLock(lock, build);
		const waiter = start(["--", "true"], cliEnvironment(lock));
		try {
			await waitFor(() => waiter.stderr().includes("waiting for"));

			process.kill(waiter.pid, "SIGTERM");

			expect((await waiter.exited).status).toBe(143);
			expect(readLock(lock)).toBe(build);
			expect(lockDirectory(lock)).toEqual(["heavy-process.lock"]);
		} finally {
			waiter.stop();
		}
	},
	TEST_TIMEOUT_MS,
);

it.each([
	["cannot run ps", "", "Could not run ps to read this process's start time."],
	["gets no start time from ps", "#!/bin/sh\nexit 0\n", "Could not read this process's start time from ps."],
])(
	"fails before running the command when it %s",
	async (_, fakePs, message) => {
		const lock = temporaryLock();
		const bin = temporaryDirectory();
		if (fakePs !== "") {
			writeFileSync(join(bin, "ps"), fakePs);
			chmodSync(join(bin, "ps"), 0o755);
		}
		const marker = join(bin, "ran");

		const result = await runCli(["--", "/usr/bin/touch", marker], cliEnvironment(lock, { PATH: bin }));

		expect(result).toEqual({ status: 1, stderr: `heavy-lock: ${message}\n` });
		expect(existsSync(marker)).toBe(false);
		expect(existsSync(lock)).toBe(false);
	},
	TEST_TIMEOUT_MS,
);
