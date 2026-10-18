import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { clientContainers, containerIs, dockerIsUnavailable } from "#test/postgresTraits.ts";

postgres.it(
	"preserves Docker daemon failures before attempting to change any container",
	[dockerIsUnavailable()],
	function* ({ startContainer, stop }) {
		expect(startContainer).toThrow("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?");
		yield* stop();
	},
);

for (const ids of ["", "first\nsecond\n"]) {
	postgres.it(`refuses an ambiguous PostgreSQL client selection ${JSON.stringify(ids)}`, [clientContainers(ids)], function* ({ selectClient, stop }) {
		expect(selectClient).toThrow("Install psql or start the shared PostgreSQL service with Docker.");
		yield* stop();
	});
}

postgres.it(
	"refuses to execute SQL in a container with an unpinned image",
	[clientContainers("container-id\n", "postgres:17-alpine\n")],
	function* ({ selectClient, stop }) {
		expect(selectClient).toThrow("The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.");
		yield* stop();
	},
);

postgres.it("starts an existing pinned container without creating or replacing it", [containerIs("existing")], function* ({ startContainer, stop }) {
	startContainer();
	yield* stop();
});

postgres.it("preserves an existing container whose image needs an explicit upgrade", [containerIs("outdated")], function* ({ startContainer, stop }) {
	expect(startContainer).toThrow("The shared PostgreSQL container uses a different image. Preserve its volume and upgrade it explicitly.");
	yield* stop();
});

postgres.it(
	"creates a missing container with a persistent volume and a loopback-only published port",
	[containerIs("missing")],
	function* ({ startContainer, stop }) {
		startContainer();
		yield* stop();
	},
);
