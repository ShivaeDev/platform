import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { postgres } from "#test/postgres.ts";
import { containerListingFails, dockerDaemonDown, outdatedContainer, stoppedPinnedContainer } from "#test/postgresTraits.ts";

postgres.it(
	"with the Docker daemon down, starting the container fails with Docker's own message and runs no other Docker command",
	[dockerDaemonDown()],
	function* ({ dockerCommands, outcome, startContainer }) {
		yield* startContainer();

		yield* outcomes([
			["Docker commands", () => dockerCommands(), ["docker info"]],
			["outcome", () => outcome(), "failed: Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?"],
		]);
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

		yield* outcomes([
			["container changes", () => containerChanges(), []],
			["outcome", () => outcome(), "failed: The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly."],
		]);
	},
);

postgres.it(
	"a failed container listing reaches the caller as PostgresCommandError without creating or starting a container",
	[containerListingFails()],
	function* ({ containerChanges, failureKind, outcome, startContainer }) {
		yield* startContainer();

		yield* outcomes([
			["container changes", () => containerChanges(), []],
			["diagnostic", () => outcome(), "failed: Cannot list containers"],
			["failure", () => failureKind(), "setup command failed"],
		]);
	},
);
