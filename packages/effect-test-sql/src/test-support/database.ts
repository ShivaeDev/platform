import * as PgClient from "@effect/sql-pg/PgClient";
import { Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { applicationVerbs } from "./applicationVerbs.ts";
import { budgetVerbs } from "./budgetVerbs.ts";
import { createDatabaseEngine } from "./databaseEngine.ts";
import { idleVerbs } from "./idleVerbs.ts";
import { isolationVerbs } from "./isolationVerbs.ts";
import { lifecycleVerbs } from "./lifecycleVerbs.ts";
import { limitVerbs } from "./limitVerbs.ts";
import { narrated } from "./narrated.ts";
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
	verbs: (engine, story) => {
		const isolation = isolationVerbs(engine);
		const verbs = {
			...transactionVerbs(engine),
			...applicationVerbs(engine),
			...lifecycleVerbs(engine),
			...limitVerbs(engine),
			...budgetVerbs(engine),
			...poolVerbs(engine),
			...idleVerbs(engine),
			...rowLockVerbs(engine),
		};
		return {
			...isolation,
			adminConnectionIsReleased: narrated(story.tell, "admin connection is released", verbs.adminConnectionIsReleased),
			applicationFinalizersKeepDatabaseOpen: narrated(
				story.tell,
				"application finalizers keep their database open",
				verbs.applicationFinalizersKeepDatabaseOpen,
			),
			applicationLayersUseTheirOwnClient: narrated(story.tell, "application layers use their own client", verbs.applicationLayersUseTheirOwnClient),
			cloneExplainsConnectionLimit: narrated(story.tell, "clone explains connection limit", verbs.cloneExplainsConnectionLimit),
			closeWorker: narrated(story.tell, "the worker scope closes and drains database cleanup", isolation.closeWorker),
			commitItem: narrated(story.tell, "an item commits in its clone", isolation.commitItem),
			connectionBudgetIsRespected: narrated(story.tell, "connection budget is respected", verbs.connectionBudgetIsRespected),
			failedPreparationDropsDatabase: narrated(story.tell, "failed preparation drops database", verbs.failedPreparationDropsDatabase),
			idleConnectionsAndDatabasesAreReleased: narrated(
				story.tell,
				"idle connections and databases are released",
				verbs.idleConnectionsAndDatabasesAreReleased,
			),
			migrationsAreCopiedWithoutFixtures: narrated(story.tell, "migrations are copied without fixtures", verbs.migrationsAreCopiedWithoutFixtures),
			otherSqlErrorsKeepIdentity: narrated(story.tell, "other sql errors keep identity", verbs.otherSqlErrorsKeepIdentity),
			parallelWritesStayPrivate: narrated(story.tell, "parallel writes stay private", verbs.parallelWritesStayPrivate),
			preparationWasSkipped: narrated(story.tell, "preparation was skipped", verbs.preparationWasSkipped),
			rollbackExplainsConnectionLimit: narrated(story.tell, "rollback explains connection limit", verbs.rollbackExplainsConnectionLimit),
			rollbackPreservesExits: narrated(story.tell, "rollback preserves exits", verbs.rollbackPreservesExits),
			rollbackReleasesRowLock: narrated(story.tell, "rollback releases row lock", verbs.rollbackReleasesRowLock),
			savepointsSuppressInvalidations: narrated(story.tell, "savepoints suppress invalidations", verbs.savepointsSuppressInvalidations),
			sequenceStateSurvivesRollback: narrated(story.tell, "sequence state survives rollback", verbs.sequenceStateSurvivesRollback),
			setupExplainsConnectionLimit: narrated(story.tell, "setup explains connection limit", verbs.setupExplainsConnectionLimit),
			writeItem: narrated(story.tell, "an item is written in its clone", isolation.writeItem),
			writeSharedItem: narrated(story.tell, "an item is written in the shared database", isolation.writeSharedItem),
		};
	},
});
