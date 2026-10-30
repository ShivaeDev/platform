import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { connections, keptRow, setupConnectsAsUnprivilegedRole, stockContainer, unpinnedStockContainer } from "#test/connections.ts";

const STOCK_LIMIT = 100;
const SETUP_LIMIT = 500;

connections.it(
	`setup creates the missing shared container, and it allows ${SETUP_LIMIT} connections`,
	[],
	function* ({ container, maxConnections, start }) {
		expect(yield* container()).toBe("no container");

		yield* start();

		yield* outcomes({
			"container": [container(), "a new container"],
			"max connections": [maxConnections(), SETUP_LIMIT],
		});
	},
);

connections.it(
	`setup raises a running stock container from ${STOCK_LIMIT} to ${SETUP_LIMIT} connections`,
	[stockContainer()],
	function* ({ maxConnections, start }) {
		expect(yield* maxConnections()).toBe(STOCK_LIMIT);

		yield* start();

		expect(yield* maxConnections()).toBe(SETUP_LIMIT);
	},
);

connections.it("raising the limit restarts the same container instead of replacing it", [stockContainer()], function* ({ container, start }) {
	yield* start();

	expect(yield* container()).toBe("the same container, restarted");
});

connections.it("raising the limit keeps the container's rows", [stockContainer(), keptRow()], function* ({ rows, start }) {
	expect(yield* rows()).toEqual(["existing data"]);

	yield* start();

	expect(yield* rows()).toEqual(["existing data"]);
});

for (const allowing of [SETUP_LIMIT, 600]) {
	connections.it(
		`setup leaves a container that allows ${allowing} connections at ${allowing}, without a restart`,
		[stockContainer({ allowing })],
		function* ({ container, maxConnections, start }) {
			expect(yield* maxConnections()).toBe(allowing);

			yield* start();

			yield* outcomes({
				"container": [container(), "the same container, still running"],
				"max connections": [maxConnections(), allowing],
			});
		},
	);
}

connections.it(
	"when PostgreSQL refuses the change, setup fails with a PostgresSettingError for max_connections in development-postgres caused by the refusal",
	[stockContainer(), setupConnectsAsUnprivilegedRole()],
	function* ({ outcome, start }) {
		yield* start();

		expect(yield* outcome()).toBe('max_connections refused in development-postgres: ERROR:  permission denied to set parameter "max_connections"');
	},
);

connections.it(
	`a refused change leaves the container running at ${STOCK_LIMIT} connections, without a restart`,
	[stockContainer(), setupConnectsAsUnprivilegedRole()],
	function* ({ container, maxConnections, start }) {
		expect(yield* maxConnections()).toBe(STOCK_LIMIT);

		yield* start();

		yield* outcomes({
			"container": [container(), "the same container, still running"],
			"max connections": [maxConnections(), STOCK_LIMIT],
		});
	},
);

connections.it(
	"setup refuses to raise the limit of a container that does not name the pinned image, and leaves it running",
	[unpinnedStockContainer()],
	function* ({ container, outcome, start }) {
		yield* start();

		yield* outcomes({
			"container": [container(), "the same container, still running"],
			"setup": [
				outcome(),
				"max_connections refused in development-postgres: The shared PostgreSQL container uses a different image. Preserve its data and upgrade it explicitly.",
			],
		});
	},
);
