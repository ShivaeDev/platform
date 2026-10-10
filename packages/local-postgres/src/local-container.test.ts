import { expect, it } from "vitest";
import { sqlInContainer, startContainer } from "#local-container.ts";
import { localServer } from "#localPostgres.ts";
import { dockerScript, PINNED_IMAGE } from "#test/dockerScript.ts";

it("preserves Docker daemon failures before attempting to change any container", () => {
	const failure = new Error("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?");
	const docker = dockerScript([{ args: ["info"], result: failure }]);
	expect(() => startContainer(docker.run)).toThrow(failure);
	docker.done();
});

it("refuses to choose a PostgreSQL client when Docker reports no container or multiple containers", () => {
	for (const ids of ["", "first\nsecond\n"]) {
		const docker = dockerScript([{ args: ["ps", "--filter", "publish=55432", "--format", "{{.ID}}"], result: ids }]);
		expect(() => sqlInContainer(docker.run, new URL(`${localServer}/postgres`), [], { encoding: "utf8" })).toThrow(
			"Install psql or start the shared PostgreSQL service with Docker.",
		);
		docker.done();
	}
});

it("refuses to execute SQL in a container with an unpinned image", () => {
	const docker = dockerScript([
		{ args: ["ps", "--filter", "publish=55432", "--format", "{{.ID}}"], result: "container-id\n" },
		{ args: ["inspect", "--format", "{{.Config.Image}}", "container-id"], result: "postgres:17-alpine\n" },
	]);
	expect(() => sqlInContainer(docker.run, new URL(`${localServer}/postgres`), [], { encoding: "utf8" })).toThrow(
		"The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.",
	);
	docker.done();
});

it("starts an existing pinned container without creating or replacing it", () => {
	const docker = dockerScript([
		{ args: ["info"], result: "Docker is available" },
		{ args: ["container", "inspect", "development-postgres"], result: "[]" },
		{ args: ["inspect", "--format", "{{.Config.Image}}", "development-postgres"], result: `${PINNED_IMAGE}\n` },
		{ args: ["start", "development-postgres"], result: "development-postgres\n" },
	]);
	startContainer(docker.run);
	docker.done();
});

it("preserves an existing container whose image needs an explicit upgrade", () => {
	const docker = dockerScript([
		{ args: ["info"], result: "Docker is available" },
		{ args: ["container", "inspect", "development-postgres"], result: "[]" },
		{ args: ["inspect", "--format", "{{.Config.Image}}", "development-postgres"], result: "postgres:17-alpine" },
	]);
	expect(() => startContainer(docker.run)).toThrow(
		"The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly.",
	);
	docker.done();
});

it("creates a missing container with a persistent volume and a loopback-only published port", () => {
	const docker = dockerScript([
		{ args: ["info"], result: "Docker is available" },
		{ args: ["container", "inspect", "development-postgres"], result: new Error("No such container: development-postgres") },
		{
			args: [
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
			result: "new-container-id\n",
		},
	]);
	startContainer(docker.run);
	docker.done();
});
