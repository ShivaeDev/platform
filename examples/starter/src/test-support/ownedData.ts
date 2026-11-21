import { DateTime, Effect, Layer } from "effect";
import { accountData } from "@shivaedev/identity/server/better-auth/accountData.ts";
import { JobsClientFactory } from "@shivaedev/jobs/server/JobsClientFactory.ts";
import { collectRepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { jobsLayer } from "#server/jobsLayer.ts";
import { serverModules } from "#server/modules.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { configured, postgres } from "#test-support/postgres.ts";

export const ownedData = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		return { database: yield* PostgresTestDatabase, testing: makePgBossTesting() };
	},
	layer: postgres,
	name: "owned account data",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => ({
		coverage: () => {
			story.tell(
				"the application's module services are built, as the host builds them, and identity checks the migrated database's personal columns",
			);
			return Effect.gen(function* () {
				const modules = yield* serverModules(Layer.empty);
				const jobs = jobsLayer(engine.database.url, testPoolSizes.jobs).pipe(
					Layer.provide(Layer.succeed(JobsClientFactory, engine.testing.clientFactory)),
				);
				yield* Layer.build(modules.services.pipe(Layer.provide(jobs)));
				return yield* accountData(AppAuth).check.pipe(
					Effect.as("covered" as const),
					Effect.catchTag("UncoveredUserColumns", ({ columns }) => Effect.succeed(columns)),
				);
			}).pipe(Effect.scoped, Effect.provide(collectRepositoryModels));
		},
	}),
});
