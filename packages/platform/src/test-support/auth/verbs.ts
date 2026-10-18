import type { DBTransactionAdapter, Where } from "better-auth";
import { Effect } from "effect";
import { Database } from "./database.ts";
import type { authEngine } from "./engine.ts";

type State = Effect.Success<ReturnType<typeof authEngine>>;
export interface User {
	email: string;
	id: string;
	name: string;
}
export function authVerbs(state: State, tell: (line: string) => void) {
	function invoke<A>(action: () => Promise<A>, context: "story" | "runtime" = "story") {
		return Effect.tryPromise({
			catch: (error) => error,
			try: () => (context === "story" ? state.adapter.runWithServices(state.services, action) : action()),
		});
	}
	return {
		count: (where: Where[]) => invoke(() => state.authDatabase.count({ model: "user", where })),
		createUser: (data: User) => {
			tell(`the adapter creates ${data.name}`);
			return invoke(() => state.authDatabase.create<User, User>({ data, forceAllowId: true, model: "user" }));
		},
		delete: (where: Where[]) => invoke(() => state.authDatabase.delete({ model: "user", where })),
		deleteMany: (where: Where[]) => invoke(() => state.authDatabase.deleteMany({ model: "user", where })),
		findMany: (input: Omit<Parameters<typeof state.authDatabase.findMany>[0], "model">) => {
			tell("the adapter queries PostgreSQL users");
			return invoke(() => state.authDatabase.findMany<User>({ ...input, model: "user" }));
		},
		findOne: (input: Omit<Parameters<typeof state.authDatabase.findOne>[0], "model">) =>
			invoke(() => state.authDatabase.findOne<User>({ ...input, model: "user" })),
		persistedUserExists: (id: string) =>
			Effect.promise(() => state.runtime.runPromise(Effect.flatMap(Database, (db) => db.AuthUser.where({ id }).exists()))),
		transaction: <A>(action: (transaction: DBTransactionAdapter) => Promise<A>, context: "story" | "runtime" = "story") => {
			tell(`the adapter runs a transaction with ${context} services`);
			return invoke(() => state.authDatabase.transaction(action), context);
		},
		update: (where: Where[], update: Record<string, unknown>) => invoke(() => state.authDatabase.update<User>({ model: "user", update, where })),
		updateMany: (where: Where[], update: Record<string, unknown>) => invoke(() => state.authDatabase.updateMany({ model: "user", update, where })),
		userExists: (id: string) => state.db.AuthUser.where({ id }).exists(),
	};
}
