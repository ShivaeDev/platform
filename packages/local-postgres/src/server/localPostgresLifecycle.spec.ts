import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { discoveryFails, readyAfter, startupAttempts } from "#test/postgresTraits.ts";

const PENDING_PROBES = 2;

postgres.it(
	"steps readiness probes until PostgreSQL reports the pinned version",
	[readyAfter(PENDING_PROBES)],
	function* ({ checkReadiness, readinessAttempts, operations }) {
		yield* checkReadiness();
		expect(readinessAttempts()).toBe(PENDING_PROBES + 1);
		expect(operations()).toEqual([
			...Array.from({ length: PENDING_PROBES + 1 }, () => ["docker", "ps", "--filter", "publish=55432", "--format", "{{.ID}}"]),
			["docker", "inspect", "--format", "{{.Config.Image}}", "container-id"],
			[
				"docker",
				"exec",
				"--env",
				"PGPASSWORD",
				"container-id",
				"psql",
				"-X",
				"--set",
				"ON_ERROR_STOP=1",
				"-At",
				"-c",
				"SHOW server_version",
				"--dbname",
				"postgresql://postgres@127.0.0.1:5432/postgres?connect_timeout=3",
			],
		]);
	},
);

postgres.it(
	"retries Docker discovery while a started container becomes ready, then checks real PostgreSQL",
	[discoveryFails(2)],
	function* ({ start, checkReadiness, discoveryProbes, operations, subprocessCalls, subprocessEncodings }) {
		expect(start).not.toThrow();
		yield* checkReadiness();
		const expectedProbes = 5;
		expect(discoveryProbes()).toBe(expectedProbes);
		expect(operations().slice(1, 5)).toEqual([
			["docker", "info"],
			["docker", "container", "inspect", "development-postgres"],
			["docker", "inspect", "--format", "{{.Config.Image}}", "development-postgres"],
			["docker", "start", "development-postgres"],
		]);
		expect(operations().filter(([, command]) => command === "ps")).toEqual(
			Array.from({ length: expectedProbes }, () => ["docker", "ps", "--filter", "publish=55432", "--format", "{{.ID}}"]),
		);
		expect(subprocessCalls().filter(([file]) => file === "psql")).toEqual(
			["SHOW server_version", "SHOW server_version", "SHOW server_version", "SHOW max_connections", "SHOW server_version"].map((query) => [
				"psql",
				"-X",
				"--set",
				"ON_ERROR_STOP=1",
				"-At",
				"-c",
				query,
				"--dbname",
				"postgresql://postgres@127.0.0.1:55432/postgres?connect_timeout=3",
			]),
		);
		expect(
			operations()
				.filter(([, command]) => command === "exec")
				.map((args) => [...args.slice(0, 4), ...args.slice(5)]),
		).toEqual(
			["SHOW server_version", "SHOW max_connections", "SHOW server_version"].map((query) => [
				"docker",
				"exec",
				"--env",
				"PGPASSWORD",
				"psql",
				"-X",
				"--set",
				"ON_ERROR_STOP=1",
				"-At",
				"-c",
				query,
				"--dbname",
				"postgresql://postgres@127.0.0.1:5432/postgres?connect_timeout=3",
			]),
		);
		expect(subprocessEncodings()).toEqual(subprocessCalls().map(() => "utf8"));
	},
);

const ALLOWED_ATTEMPTS = 3;

postgres.it(
	"stops after the configured readiness attempts when Docker never reports a PostgreSQL container",
	[discoveryFails(4), startupAttempts(ALLOWED_ATTEMPTS)],
	({ start, discoveryProbes }) => {
		expect(start).toThrow("Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.");
		expect(discoveryProbes()).toBe(ALLOWED_ATTEMPTS + 1);
	},
);

const FAILED_DISCOVERIES = 31;

postgres.it("makes thirty readiness attempts by default", [discoveryFails(FAILED_DISCOVERIES)], ({ start, discoveryProbes }) => {
	expect(start).toThrow("Expected local PostgreSQL 18.6.");
	expect(discoveryProbes()).toBe(FAILED_DISCOVERIES);
});
