import { execFileSync } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { localPostgres } from "#localPostgres.ts";
import { dockerReadiness } from "#test/dockerReadiness.ts";

vi.mock("node:child_process", async (original) => {
	const module = await original<typeof import("node:child_process")>();
	return { ...module, execFileSync: vi.fn(module.execFileSync) };
});
afterEach(() => vi.mocked(execFileSync).mockReset());

it("retries Docker discovery while a started container becomes ready, then checks real PostgreSQL", async () => {
	const real = await vi.importActual<typeof import("node:child_process")>("node:child_process");
	const docker = dockerReadiness(2, real.execFileSync);
	vi.mocked(execFileSync).mockImplementation(docker.run);
	expect(() => localPostgres({}).startPostgres()).not.toThrow();
	docker.done(3);
});
