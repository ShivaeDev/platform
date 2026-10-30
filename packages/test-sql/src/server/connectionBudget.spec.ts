import { expect } from "vitest";
import { database } from "#test/database.ts";
import { poolLimit } from "#test/databaseTraits.ts";

for (const [pools, traits, opened] of [
	["by default", [], 2],
	["when pools allow 3 connections", [poolLimit(3)], 3],
] as const) {
	database.it(
		`${pools}, when 3 clones each ask for 6 connections at once, each clone's pool opens ${opened}`,
		traits,
		function* ({ clonesDemandConnections, connectionsPerClone }) {
			yield* clonesDemandConnections({ clones: 3, each: 6 });

			expect(yield* connectionsPerClone()).toEqual([opened, opened, opened]);
		},
	);
}
