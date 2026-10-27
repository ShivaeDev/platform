import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Exit, Layer, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cleanupVerbs } from "./cleanupVerbs.ts";
import { createDatabaseEngine } from "./databaseEngine.ts";
import { limitedRole } from "./limitedRole.ts";
import { adminUrl, configured } from "./postgres.ts";

export const cleanup = storyKit({
	after: { configuration: (state) => state.engine.lease() },
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const roleScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
			const engine = yield* createDatabaseEngine;
			const cloneScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
			const leftovers: string[] = [];
			return { cloneScope, engine, leftovers, name: "", roleScope };
		}),
	inspect: (state) => ({ database: state.name, leftovers: state.leftovers }),
	layer: PgClient.layer({ url: adminUrl }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "database cleanup",
	runIf: configured,
	stages: ["configuration", "activity"],
	verbs: cleanupVerbs,
});

export const limitedCleanupRole = cleanup.trait("configuration", "the owner has a connection budget", function* ({ engine, roleScope }) {
	engine.options = { ...engine.options, url: yield* limitedRole(2).pipe(Effect.provideService(Scope.Scope, roleScope)) };
});

export const leftoverDatabase = cleanup.trait("configuration", "a crashed run left a database", function* (state) {
	const admin = state.engine.admin;
	state.name = `effect_test_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(admin`create database ${admin(state.name)}`, () =>
		Effect.orDie(admin`drop database if exists ${admin(state.name)} with (force)`),
	);
});

export const crashedRun = cleanup.trait("configuration", "a worker exits without closing its layer", function* (state) {
	const result = yield* Effect.promise(() =>
		promisify(execFile)(process.execPath, ["--conditions=source", fileURLToPath(new URL("./crashedDatabase.ts", import.meta.url))]),
	);
	state.name = result.stdout;
	const admin = state.engine.admin;
	const prefix = state.name.slice(0, state.name.lastIndexOf("_") + 1);
	state.leftovers = (yield* admin<{ datname: string }>`select datname from pg_database where starts_with(datname, ${prefix}) order by datname`).map(
		(row) => row.datname,
	);
	yield* Effect.addFinalizer(() =>
		Effect.forEach(state.leftovers, (name) => admin`drop database if exists ${admin(name)} with (force)`).pipe(Effect.orDie),
	);
});
