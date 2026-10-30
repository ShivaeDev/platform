import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { postgres } from "#test/postgres.ts";
import { activeDockerContext, dockerDaemonAnswers, dockerHost, namedDockerContext } from "#test/postgresTraits.ts";

const LOCAL_SOCKET = "unix:///var/run/docker.sock";
const REFUSED = "failed: Local database setup requires a local Docker endpoint; remote contexts are refused.";

for (const host of [LOCAL_SOCKET, "npipe:////./pipe/docker_engine", "tcp://localhost:2375", "tcp://127.0.0.1:2375", "tcp://[::1]:2375"]) {
	postgres.it(
		`setup accepts DOCKER_HOST ${host} as local and checks the Docker daemon there`,
		[dockerHost(host), dockerDaemonAnswers()],
		function* ({ checkDocker, outcome }) {
			yield* checkDocker();

			expect(yield* outcome()).toBe("Docker is available");
		},
	);
}

postgres.it(
	"without DOCKER_HOST or DOCKER_CONTEXT, setup reads the active context's endpoint and checks the Docker daemon there",
	[activeDockerContext(LOCAL_SOCKET), dockerDaemonAnswers()],
	function* ({ checkDocker, inspectedContexts, outcome }) {
		yield* checkDocker();

		yield* outcomes({
			"daemon check": [outcome(), "Docker is available"],
			"inspected contexts": [inspectedContexts(), ["the active context"]],
		});
	},
);

postgres.it(
	"DOCKER_CONTEXT wins over a remote DOCKER_HOST: setup reads that context's local endpoint and checks the Docker daemon there",
	[dockerHost("ssh://remote.example"), namedDockerContext("desktop-linux", LOCAL_SOCKET), dockerDaemonAnswers()],
	function* ({ checkDocker, inspectedContexts, outcome }) {
		yield* checkDocker();

		yield* outcomes({
			"daemon check": [outcome(), "Docker is available"],
			"inspected contexts": [inspectedContexts(), ["desktop-linux"]],
		});
	},
);

for (const [endpoint, given] of [
	["DOCKER_HOST ssh://example.com", [dockerHost("ssh://example.com")]],
	["DOCKER_HOST tcp://example.com:2376", [dockerHost("tcp://example.com:2376")]],
	[
		"the remote context that DOCKER_CONTEXT names, despite a local DOCKER_HOST",
		[dockerHost(LOCAL_SOCKET), namedDockerContext("remote", "tcp://remote.example:2376")],
	],
] as const) {
	postgres.it(`setup refuses ${endpoint} before it runs any Docker command`, given, function* ({ checkDocker, dockerCommands, outcome }) {
		yield* checkDocker();

		yield* outcomes({
			"Docker commands": [dockerCommands(), []],
			"daemon check": [outcome(), REFUSED],
		});
	});
}
