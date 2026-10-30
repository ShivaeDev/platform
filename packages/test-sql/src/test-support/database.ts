import * as PgClient from "@effect/sql-pg/PgClient";
import { Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createDatabaseEngine } from "./databaseEngine.ts";
import { databaseVerbs } from "./databaseVerbs.ts";
import { limitVerbs } from "./limitVerbs.ts";
import { adminUrl, configured } from "./postgres.ts";
import { raceVerbs } from "./raceVerbs.ts";

export const database = storyKit({
	after: { configuration: (engine) => engine.lease() },
	clock: "live",
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
