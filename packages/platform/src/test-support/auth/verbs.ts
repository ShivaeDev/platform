import type { BetterAuthOptions, Where } from "better-auth";
import { Effect } from "effect";
import { effectPrismaAdapter } from "#better-auth/adapter.ts";
import { Database } from "./database.ts";
import type { authEngine } from "./engine.ts";

type State = Effect.Success<ReturnType<typeof authEngine>>;
interface User {
	email: string;
	id: string;
	name: string;
}
export function authVerbs(state: State, tell: (line: string) => void) {
	function invoke<A>(action: () => Promise<A>) {
		return Effect.tryPromise({ catch: (error) => error, try: () => state.adapter.runWithServices(state.services, action) });
	}
	function configured(options: BetterAuthOptions, explicit = true) {
		return effectPrismaAdapter(Database, state.runtime, explicit ? { modelName: () => "AuthUser" } : {})(options);
	}
	return {
		configuredCount: () => invoke(() => configured({ user: { modelName: "authUser" } }, false).count({ model: "user", where: [] })),
		count: (where: Where[]) => invoke(() => state.authDatabase.count({ model: "user", where })),
		createUser: (data: User) => {
			tell(`the adapter creates ${data.name}`);
			return invoke(() => state.authDatabase.create<User, User>({ data, forceAllowId: true, model: "user" }));
		},
		delete: (where: Where[]) => invoke(() => state.authDatabase.delete({ model: "user", where })),
		deleteMany: (where: Where[]) => invoke(() => state.authDatabase.deleteMany({ model: "user", where })),
		failedTransaction: (data: User) =>
			Effect.tryPromise({
				catch: (error) => error,
				try: () =>
					state.authDatabase.transaction(async (transaction) => {
						tell("a Better Auth transaction creates a user and fails outside the story rollback");
						await transaction.create<User, User>({ data, forceAllowId: true, model: "user" });
						throw new Error("rollback");
					}),
			}).pipe(Effect.flip),
		findMany: (input: Omit<Parameters<typeof state.authDatabase.findMany>[0], "model">) => {
			tell("the adapter queries PostgreSQL users");
			return invoke(() => state.authDatabase.findMany<User>({ ...input, model: "user" }));
		},
		findOne: (where: Where[]) => invoke(() => state.authDatabase.findOne<User>({ model: "user", where })),
		joinedRead: (many: boolean) =>
			invoke(() => {
				const adapter = configured({ advanced: { database: { joins: true } } });
				const input = { join: { session: true }, model: "user", where: [{ field: "id", value: crypto.randomUUID() }] };
				return many ? adapter.findMany(input) : adapter.findOne(input);
			}).pipe(Effect.flip),
		mismatchedField: (sort: boolean) =>
			invoke<unknown>(() => {
				const adapter = configured({ user: { fields: { name: "missing_column" } } });
				return sort
					? adapter.findMany({ model: "user", sortBy: { direction: "asc", field: "missing_column" } })
					: adapter.count({ model: "user", where: [{ field: "name", value: "Ada" }] });
			}).pipe(Effect.flip),
		persistedUserExists: (id: string) =>
			Effect.promise(() => state.runtime.runPromise(Effect.flatMap(Database, (db) => db.AuthUser.where({ id }).exists()))),
		seedUser: (data: User) => state.db.AuthUser.create(data),
		transactionCreate: (data: User) =>
			invoke(() => state.authDatabase.transaction((transaction) => transaction.create<User, User>({ data, forceAllowId: true, model: "user" }))),
		update: (where: Where[], update: Record<string, unknown>) => invoke(() => state.authDatabase.update<User>({ model: "user", update, where })),
		updateMany: (where: Where[], update: Record<string, unknown>) => invoke(() => state.authDatabase.updateMany({ model: "user", update, where })),
		userExists: (id: string) => state.db.AuthUser.where({ id }).exists(),
	};
}
