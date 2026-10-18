import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { dockerContext, dockerEndpoint, dockerIsAvailable } from "#test/postgresTraits.ts";

for (const host of [
	"unix:///var/run/docker.sock",
	"npipe:////./pipe/docker_engine",
	"tcp://localhost:2375",
	"tcp://127.0.0.1:2375",
	"tcp://[::1]:2375",
]) {
	postgres.it(`accepts the local Docker endpoint ${host}`, [dockerEndpoint(host), dockerIsAvailable()], function* ({ verifyDocker, stop }) {
		expect(verifyDocker()).toBe("local Docker");
		yield* stop();
	});
}

for (const context of [undefined, "desktop-linux"]) {
	postgres.it(
		`resolves the ${context ?? "active"} context before the Docker operation`,
		[dockerContext(context), dockerIsAvailable()],
		function* ({ verifyDocker, contextInspections, stop }) {
			expect(verifyDocker()).toBe("local Docker");
			expect(contextInspections()).toEqual([
				["docker", "context", "inspect", ...(context ? [context] : []), "--format", "{{.Endpoints.docker.Host}}"],
			]);
			yield* stop();
		},
	);
}

postgres.it(
	"refuses the remote endpoint selected by a named context before any Docker operation",
	[dockerContext("remote", "tcp://remote.example:2376"), dockerEndpoint("unix:///var/run/docker.sock")],
	function* ({ verifyDocker, operations, stop }) {
		expect(verifyDocker).toThrow("Local database setup requires a local Docker endpoint; remote contexts are refused.");
		expect(operations()).toEqual([]);
		yield* stop();
	},
);
