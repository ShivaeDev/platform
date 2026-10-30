import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { PINNED_IMAGE } from "#test/dockerScript.ts";
import { postgres } from "#test/postgres.ts";
import { dockerDaemonDown, noContainer, outdatedContainer, stoppedPinnedContainer } from "#test/postgresTraits.ts";

postgres.it(
	"with the Docker daemon down, starting the container fails with Docker's own message and runs no other Docker command",
	[dockerDaemonDown()],
	function* ({ dockerCommands, outcome, startContainer }) {
		yield* startContainer();

		yield* outcomes({
			"Docker commands": [dockerCommands(), ["docker info"]],
			"outcome": [outcome(), "failed: Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?"],
		});
	},
);

postgres.it(
	"starting a stopped pinned container starts it, without creating or replacing a container",
	[stoppedPinnedContainer()],
	function* ({ containerChanges, startContainer }) {
		yield* startContainer();

		expect(yield* containerChanges()).toEqual(["docker start development-postgres"]);
	},
);

postgres.it(
	"starting a container with an older image fails asking for an explicit upgrade and changes no container",
	[outdatedContainer()],
	function* ({ containerChanges, outcome, startContainer }) {
		yield* startContainer();

		yield* outcomes({
			"container changes": [containerChanges(), []],
			"outcome": [outcome(), "failed: The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly."],
		});
	},
);

postgres.it(
	"starting a missing container creates it from the pinned image with a persistent volume and a port published on loopback only",
	[noContainer()],
	function* ({ containerChanges, startContainer }) {
		yield* startContainer();

		expect(yield* containerChanges()).toEqual([
			[
				"docker run --detach --name development-postgres",
				"--publish 127.0.0.1:55432:5432",
				"--env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=postgres",
				"--mount type=volume,src=development-postgres,dst=/var/lib/postgresql",
				PINNED_IMAGE,
			].join(" "),
		]);
	},
);
