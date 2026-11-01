import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { conflictingDockerEnvironment, dockerEndpoint, matchingDockerEnvironment } from "#test/dockerEndpoint.ts";

for (const [operation, args, request] of [
	["daemon checks", ["info", "--format", "{{.ID}}"], "GET /v1.47/info"],
	["container listings", ["container", "ls", "--all"], "GET /v1.47/containers/json"],
	["container inspections", ["inspect", "development-postgres"], "GET /v1.47/containers/development-postgres/json"],
	["container starts", ["start", "development-postgres"], "POST /v1.47/containers/development-postgres/start"],
	["container restarts", ["restart", "development-postgres"], "POST /v1.47/containers/development-postgres/restart"],
	["container creations", ["run", "--detach", "postgres:18-alpine"], "POST /v1.47/containers/create"],
	["container commands", ["exec", "--detach", "development-postgres", "true"], "POST /v1.47/exec/query/start"],
] as const) {
	dockerEndpoint.it(`${operation} complete at the endpoint approved by context validation`, [], function* ({ requests: received, run, succeeded }) {
		yield* run(args);

		yield* outcomes([
			["operation completed", () => succeeded(), true],
			["requests at the approved endpoint", () => received(), expect.arrayContaining([request])],
		]);
	});
}

for (const [key, value] of [
	["DOCKER_HOST", "ssh://remote.example"],
	["DOCKER_HOST", "tcp://127.0.0.1:2375"],
	["DOCKER_CONTEXT", "other-context"],
] as const) {
	dockerEndpoint.it(
		`a conflicting ${key} in the command environment is refused before any Docker invocation`,
		[conflictingDockerEnvironment(key, value)],
		function* ({ commands, outcome, run }) {
			yield* run(["info"]);

			yield* outcomes([
				["commands", () => commands(), []],
				["refusal", () => outcome(), "failed: Docker command environment conflicts with the Docker endpoint settings."],
			]);
		},
	);
}

dockerEndpoint.it(
	"matching command environment settings still reach the approved Docker daemon",
	[matchingDockerEnvironment()],
	function* ({ outcome, run }) {
		yield* run(["info", "--format", "{{.ID}}"]);

		expect(yield* outcome()).toBe("approved-daemon");
	},
);
