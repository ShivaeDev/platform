import * as PgClient from "@effect/sql-pg/PgClient";
import { Deferred, Effect, Exit, Layer, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cleanupVerbs } from "./cleanupVerbs.ts";
import { createDatabaseEngine, type DatabaseEngine } from "./databaseEngine.ts";
import { adminUrl, configured } from "./postgres.ts";

export interface CleanupEngine {
	clone: string;
	readonly cloneScope: Scope.Closeable;
	crashed: { readonly shared: string; readonly all: readonly string[] };
	readonly engine: DatabaseEngine;
	readonly firstDropAttempt: Deferred.Deferred<string>;
	leftover: string;
	otherHost: string;
	readonly roleScope: Scope.Closeable;
}

export const cleanup = storyKit({
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const roleScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
			const engine = yield* createDatabaseEngine;
			const cloneScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
			const firstDropAttempt = yield* Deferred.make<string>();
			const state: CleanupEngine = {
				clone: "",
				cloneScope,
				crashed: { all: [], shared: "" },
				engine,
				firstDropAttempt,
				leftover: "",
				otherHost: "",
				roleScope,
			};
			return state;
		}),
	inspect: ({ clone, crashed, leftover, otherHost }) => ({ clone, crashed, leftover, otherHost }),
	layer: PgClient.layer({ url: adminUrl }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "database cleanup",
	runIf: configured,
	stages: ["configuration", "run", "activity"],
	verbs: cleanupVerbs,
});
