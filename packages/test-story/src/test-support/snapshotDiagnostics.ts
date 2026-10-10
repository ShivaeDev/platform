import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Bakery } from "#test/bakery.ts";

export const snapshotTest = {
	file: join(process.cwd(), "src", "snapshot.spec.ts"),
	name: "refuses a blocked snapshot destination",
	stack: undefined,
};

export const blockedSnapshotFile = join(
	process.cwd(),
	"node_modules",
	".cache",
	"test-story",
	"snapshot.spec.ts--refuses-a-blocked-snapshot-destination--bakery.json",
);

export function nativeBakeryState(engine: Bakery) {
	const counters = { loaves: engine.loaves };
	const state = {
		counters,
		duplicate: counters,
		identifier: 9007199254740993n,
		ingredients: new Map<unknown, unknown>([[{ grain: "rye" }, 2]]),
		marker: Symbol("waiting"),
		orders: new Set(["rye", "oat"]),
		problem: new RangeError("capacity exceeded"),
	};
	return { ...state, self: counters };
}

export function withBlockedSnapshot<A>(run: () => A): A {
	mkdirSync(blockedSnapshotFile, { recursive: true });
	try {
		return run();
	} finally {
		rmSync(blockedSnapshotFile, { force: true, recursive: true });
	}
}
