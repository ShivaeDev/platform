import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { noContainerPublishesPort, twoContainersPublishPort, unpinnedContainerPublishesPort } from "#test/postgresTraits.ts";

for (const [containers, given] of [
	["no container publishes", noContainerPublishesPort()],
	["two containers publish", twoContainersPublishPort()],
] as const) {
	postgres.it(
		`without host psql, a query fails asking for psql or the shared service when ${containers} port 55432`,
		[given],
		function* ({ outcome, query }) {
			yield* query("SELECT 1");

			expect(yield* outcome()).toBe("failed: Install psql or start the shared PostgreSQL service with Docker.");
		},
	);
}

postgres.it(
	"without host psql, a query refuses to run in the container on port 55432 when its image is not the pinned one",
	[unpinnedContainerPublishesPort()],
	function* ({ outcome, query }) {
		yield* query("SELECT 1");

		expect(yield* outcome()).toBe("failed: The shared PostgreSQL image differs from the pinned baseline. Upgrade explicitly, preserving data.");
	},
);
