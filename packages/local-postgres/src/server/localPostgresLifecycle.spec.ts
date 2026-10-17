import { execFileSync } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { localPostgres } from "#localPostgres.ts";
import { dockerReadiness } from "#test/dockerReadiness.ts";

vi.mock("node:child_process", async (original) => {
	const module = await original<typeof import("node:child_process")>();
	return { ...module, execFileSync: vi.fn(module.execFileSync) };
});
afterEach(() => {
	vi.mocked(execFileSync).mockReset();
	vi.restoreAllMocks();
});

function skipReadinessWaits() {
	return vi.spyOn(Atomics, "wait").mockReturnValue("timed-out");
}

it("retries Docker discovery while a started container becomes ready, then checks real PostgreSQL", async () => {
	const real = await vi.importActual<typeof import("node:child_process")>("node:child_process");
	const docker = dockerReadiness(2, real.execFileSync);
	vi.mocked(execFileSync).mockImplementation(docker.run);
	const wait = skipReadinessWaits();
	expect(() => localPostgres({}).startPostgres()).not.toThrow();
	docker.done(3);
	expect(wait.mock.calls.map((call) => call[3])).toEqual([1000]);
});

it("stops after thirty readiness attempts a second apart when Docker never reports a PostgreSQL container", async () => {
	const real = await vi.importActual<typeof import("node:child_process")>("node:child_process");
	const docker = dockerReadiness(31, real.execFileSync);
	vi.mocked(execFileSync).mockImplementation(docker.run);
	const wait = skipReadinessWaits();
	expect(() => localPostgres({}).startPostgres()).toThrow(
		"Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.",
	);
	docker.done(31);
	expect(wait.mock.calls.map((call) => call[3])).toEqual(Array.from({ length: 30 }, () => 1000));
});
