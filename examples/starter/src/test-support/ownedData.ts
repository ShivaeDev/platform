import { type Context, DateTime, Deferred, Effect, Layer } from "effect";
import { accountData } from "@shivaedev/identity/server/better-auth/accountData.ts";
import { RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";

export const ownedData = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	create: () => ({}),
	layer: postgres,
	name: "owned account data",
	runIf: configured,
	stages: [],
	verbs: (_engine, story) => ({
		coverage: () => {
			story.tell(
				"the application host starts, and identity checks the migrated database's personal columns against the collector that the host's application Effect built its module services under",
			);
			return Effect.gen(function* () {
				const collector = yield* Deferred.make<Context.Service.Shape<typeof RepositoryModels>>();
				// Built with the module services inside the application Effect, so it sees the collector their repositories report to.
				const observed = Layer.effectDiscard(Effect.flatMap(RepositoryModels, (models) => Deferred.succeed(collector, models)));
				yield* startHost({ replacements: observed });
				return yield* accountData(AppAuth).check.pipe(
					Effect.provideService(RepositoryModels, yield* Deferred.await(collector)),
					Effect.as("covered" as const),
					Effect.catchTag("UncoveredUserColumns", ({ columns }) => Effect.succeed(columns)),
				);
			}).pipe(Effect.scoped);
		},
	}),
});
