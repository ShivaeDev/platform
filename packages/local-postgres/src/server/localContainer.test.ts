import { expect } from "vitest";
import { PINNED_IMAGE } from "#test/dockerScript.ts";
import { postgres } from "#test/postgres.ts";
import { clientContainers, containerIs, dockerIsUnavailable } from "#test/postgresTraits.ts";

postgres.it(
	"preserves Docker daemon failures before attempting to change any container",
	[dockerIsUnavailable()],
	({ startContainer, operations }) => {
		expect(startContainer).toThrow("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?");
		expect(operations()).toEqual([["docker", "info"]]);
	},
);

for (const ids of ["", "first\nsecond\n"]) {
	postgres.it(`refuses an ambiguous PostgreSQL client selection ${JSON.stringify(ids)}`, [clientContainers(ids)], ({ selectClient, operations }) => {
		expect(selectClient).toThrow("Install psql or start the shared PostgreSQL service with Docker.");
		expect(operations()).toEqual([["docker", "ps", "--filter", "publish=55432", "--format", "{{.ID}}"]]);
	});
}

postgres.it(
	"refuses to execute SQL in a container with an unpinned image",
	[clientContainers("container-id\n", "postgres:17-alpine\n")],
	({ selectClient, operations }) => {
		expect(selectClient).toThrow("The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.");
		expect(operations()).toEqual([
			["docker", "ps", "--filter", "publish=55432", "--format", "{{.ID}}"],
			["docker", "inspect", "--format", "{{.Config.Image}}", "container-id"],
		]);
	},
);

postgres.it("starts an existing pinned container without creating or replacing it", [containerIs("existing")], ({ startContainer, operations }) => {
	startContainer();
	expect(operations()).toEqual([
		["docker", "info"],
		["docker", "container", "inspect", "development-postgres"],
		["docker", "inspect", "--format", "{{.Config.Image}}", "development-postgres"],
		["docker", "start", "development-postgres"],
	]);
});

postgres.it("preserves an existing container whose image needs an explicit upgrade", [containerIs("outdated")], ({ startContainer, operations }) => {
	expect(startContainer).toThrow("The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly.");
	expect(operations()).toEqual([
		["docker", "info"],
		["docker", "container", "inspect", "development-postgres"],
		["docker", "inspect", "--format", "{{.Config.Image}}", "development-postgres"],
	]);
});

postgres.it(
	"creates a missing container with a persistent volume and a loopback-only published port",
	[containerIs("missing")],
	({ startContainer, operations }) => {
		startContainer();
		expect(operations()).toEqual([
			["docker", "info"],
			["docker", "container", "inspect", "development-postgres"],
			[
				"docker",
				"run",
				"--detach",
				"--name",
				"development-postgres",
				"--publish",
				"127.0.0.1:55432:5432",
				"--env",
				"POSTGRES_USER=postgres",
				"--env",
				"POSTGRES_PASSWORD=postgres",
				"--mount",
				"type=volume,src=development-postgres,dst=/var/lib/postgresql",
				PINNED_IMAGE,
			],
		]);
	},
);
