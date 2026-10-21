import * as PgClient from "@effect/sql-pg/PgClient";
import { type Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { applicationVerbs } from "./applicationVerbs.ts";
import { budgetVerbs } from "./budgetVerbs.ts";
import { createDatabaseEngine } from "./databaseEngine.ts";
import { idleVerbs } from "./idleVerbs.ts";
import { isolationVerbs } from "./isolationVerbs.ts";
import { lifecycleVerbs } from "./lifecycleVerbs.ts";
import { limitVerbs } from "./limitVerbs.ts";
import { poolVerbs } from "./poolVerbs.ts";
import { adminUrl, configured } from "./postgres.ts";
import { rowLockVerbs } from "./rowLockVerbs.ts";
import { transactionVerbs } from "./transactionVerbs.ts";

export const database = storyKit({
	after: { configuration: (engine) => engine.lease() },
	clock: "live",
	create: () => createDatabaseEngine,
	inspect: (engine) => ({ counts: engine.fixture.counts, template: engine.template }),
	layer: PgClient.layer({ url: adminUrl }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "database",
	runIf: configured,
	stages: ["configuration", "activity"],
	verbs: (engine) => ({
		...isolationVerbs(engine),
		inShared: <A, E, R>(effect: Effect.Effect<A, E, R>) => engine.run(effect),
		...transactionVerbs(engine),
		...applicationVerbs(),
		...lifecycleVerbs(engine),
		...limitVerbs(engine),
		...budgetVerbs(engine),
		...poolVerbs(engine),
		...idleVerbs(engine),
		...rowLockVerbs(engine),
	}),
});
