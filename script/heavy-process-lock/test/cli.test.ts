import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { afterEach, test } from "node:test";
import { HOLDER_ID_ENV } from "../acquire.ts";
import { processStartTime, readHolder } from "../holder.ts";
import { tryAcquire } from "../lock-file.ts";
import { cliEnvironment, HEAVY_CLI, holder, removeTemporaryDirectories, runHeavyCli, start, temporaryLockPaths, waitFor } from "./support.ts";

afterEach(removeTemporaryDirectories);

test("a heavy command runs holding the lock, hands its id to the command, keeps its exit code, and releases", async () => {
	const paths = temporaryLockPaths();
	const holdsLock = `grep -q "\\"id\\":\\"$${HOLDER_ID_ENV}\\"" "$HEAVY_PROCESS_LOCK" && exit 3`;

	const result = await runHeavyCli(["/bin/sh", "-c", holdsLock], cliEnvironment(paths));

	assert.equal(result.status, 3);
	assert.equal(existsSync(paths.lock), false);
});

test("a heavy command nested in another runs under the same lock instead of waiting for itself", async () => {
	const paths = temporaryLockPaths();

	const result = await runHeavyCli([process.execPath, HEAVY_CLI, "/bin/sh", "-c", "exit 3"], cliEnvironment(paths));

	assert.equal(result.status, 3);
	assert.equal(result.stderr, "");
	assert.equal(existsSync(paths.lock), false);
});

test("a second heavy command waits for the first and names it", async () => {
	const paths = temporaryLockPaths();
	const first = start(process.execPath, [HEAVY_CLI, "sleep", "1"], cliEnvironment(paths));
	await waitFor(() => readHolder(paths.lock) !== undefined);

	const second = await runHeavyCli(["true"], cliEnvironment(paths));

	assert.equal((await first.exited).status, 0);
	assert.equal(second.status, 0);
	assert.match(second.stderr, new RegExp(`waiting for pid ${first.pid} running \`sleep 1\``));
	assert.match(second.stderr, /acquired after \d+s/);
	assert.equal(existsSync(paths.lock), false);
});

test("a heavy command records its holder in the shared protocol's format, with its process start time in the C locale", async () => {
	const paths = temporaryLockPaths();
	const run = start(process.execPath, [HEAVY_CLI, "sleep", "1"], cliEnvironment(paths, { LANG: "de_DE.UTF-8", LC_ALL: "de_DE.UTF-8" }));
	await waitFor(() => readHolder(paths.lock) !== undefined);

	const recorded = readFileSync(paths.lock, "utf8");

	assert.match(recorded, /^\{"id":"[\w-]+","pid":\d+,"processStartedAt":"[^"]+","command":"sleep 1","cwd":"[^"]+","startedAtMs":\d+\}$/);
	assert.equal(readHolder(paths.lock)?.processStartedAt, processStartTime(run.pid ?? 0));
	assert.equal((await run.exited).status, 0);
});

test("CI runs the command at once, even while another run holds the lock", async () => {
	const paths = temporaryLockPaths();
	const holding = holder("typecheck");
	tryAcquire(paths.lock, holding);

	const result = await runHeavyCli(["/bin/sh", "-c", `test -z "$${HOLDER_ID_ENV}"`], cliEnvironment(paths, { CI: "true" }));

	assert.equal(result.status, 0);
	assert.equal(result.stderr, "");
	assert.deepEqual(readHolder(paths.lock), holding);
});
