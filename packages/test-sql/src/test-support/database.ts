import * as PgClient from "@effect/sql-pg/PgClient";
import { Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createDatabaseEngine } from "#test/databaseEngine.ts";
import { databaseVerbs } from "#test/databaseVerbs.ts";
import { limitVerbs } from "#test/limitVerbs.ts";
import { adminUrl, configured } from "#test/postgres.ts";
import { raceVerbs } from "#test/raceVerbs.ts";
import { withCatalogClock } from "#test/withCatalogClock.ts";

export const database = storyKit({
	after: { configuration: (engine) => engine.lease() },
	around: withCatalogClock,
	clock: "test",
	create: () => createDatabaseEngine,
	inspect: (engine) => ({
		blocks: [...engine.blocks.keys()],
		counts: engine.fixture.counts,
		endings: Object.fromEntries(engine.endings),
		start: engine.start,
	}),
	layer: PgClient.layer({ url: adminUrl }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "database",
	runIf: configured,
	stages: ["configuration", "activity"],
	verbs: (engine, story) => ({ ...databaseVerbs(engine, story), ...limitVerbs(engine, story), ...raceVerbs(engine, story) }),
});
