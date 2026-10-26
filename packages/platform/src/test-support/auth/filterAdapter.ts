import type { BetterAuthOptions, Where } from "better-auth";
import { Effect } from "effect";
import { withTestTransaction } from "@shivaedev/effect-prisma/testing/transaction.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { effectPrismaAdapter } from "#server/better-auth/adapter.ts";
import { makePlatformRuntime } from "#server/runtime/makePlatform.ts";
import { environmentVariable } from "#test/environmentVariable.ts";
import { Database } from "./native.ts";

const databaseUrl = environmentVariable("PLATFORM_PRISMA_TEST_DATABASE_URL");
const layer = Database.layer({ url: databaseUrl ?? "postgresql://integration-tests-disabled" });

export const filterAdapter = storyKit({
	around: (effect) =>
		withTestTransaction(
			Database,
			Effect.flatMap(Database, () => effect),
		),
	clock: "live",
	*create() {
		const runtime = makePlatformRuntime(layer);
		yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
		const services = yield* Effect.context<Effect.Services<typeof Database>>();
		const db = yield* Database;
		function adapter(options: BetterAuthOptions = {}, configuredNames = false) {
			return effectPrismaAdapter(
				Database,
				runtime,
				configuredNames ? {} : { modelName: (model) => `Auth${model[0]?.toUpperCase()}${model.slice(1)}` },
			)(options);
		}
		return {
			adapter,
			db,
			promise: <A>(run: () => Promise<A>) => Effect.tryPromise({ catch: (error) => error, try: () => runtime.runWithServices(services, run) }),
		};
	},
	layer,
	name: "Better Auth filter adapter",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: ({ adapter, db, promise }, story) => ({
		count: (where: Where[], options?: BetterAuthOptions, configuredNames = false) => {
			story.tell("count matching auth users through the adapter");
			return promise(() => adapter(options, configuredNames).count({ model: "user", where }));
		},
		createUser: (row: { id: string; email: string; name: string; image?: string | null }) => {
			story.tell(`store the auth user ${row.name}`);
			return db.AuthUser.create(row);
		},
		delete: (where: Where[]) => {
			story.tell("delete matching auth users");
			return promise(() => adapter().delete({ model: "user", where }));
		},
		findMany: (input: Parameters<ReturnType<typeof adapter>["findMany"]>[0], options?: BetterAuthOptions) => {
			story.tell("read filtered auth users through the adapter");
			return promise(() => adapter(options).findMany<{ name: string }>(input));
		},
		findOne: (input: Parameters<ReturnType<typeof adapter>["findOne"]>[0], options?: BetterAuthOptions) => {
			story.tell("read one auth user through the adapter");
			return promise(() => adapter(options).findOne(input));
		},
		update: (where: Where[], update: { name: string }) => {
			story.tell(`rename matching auth users to ${update.name}`);
			return promise(() => adapter().update<{ name: string }>({ model: "user", update, where }));
		},
		userExists: (id: string) => db.AuthUser.where({ id }).exists(),
	}),
});
