import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { expect } from "vitest";
import { bakery, hasOrders } from "#test/bakery.ts";

const file = join(
	process.cwd(),
	"node_modules/.cache/test-story/blockedsnapshotstories.ts--bakery-story-keeps-the-story-when-its-snapshot-cannot-be-written--bakery.json",
);

const snapshotFileIsBlocked = bakery.trait("kitchen", "the snapshot file is blocked by a directory", function* () {
	yield* Effect.acquireRelease(
		Effect.sync(() => mkdirSync(file, { recursive: true })),
		() => Effect.sync(() => rmSync(file, { force: true, recursive: true })),
	);
});

bakery.it("keeps the story when its snapshot cannot be written", [snapshotFileIsBlocked, hasOrders(60)], ({ pantry }) => {
	expect(pantry.orders(), "orders").toHaveLength(0);
});
