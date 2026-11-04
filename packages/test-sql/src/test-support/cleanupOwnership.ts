import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Effect, Scope } from "effect";
import { databaseId } from "#server/internal/databaseOwner.ts";
import { cleanup } from "./cleanup.ts";
import { dropOnStoryEnd } from "./cleanupVerbs.ts";
import { limitedRole } from "./limitedRole.ts";

const run = promisify(execFile);

export const namedCleanupPools = cleanup.trait("configuration", "the run's pools use the application name cleanup-fixture", (state) => {
	state.engine.options = { ...state.engine.options, applicationName: "cleanup-fixture" };
});

export const limitedCleanupRole = cleanup.trait(
	"configuration",
	"the run's role may open 2 connections and cannot drop other owners' databases",
	function* (state) {
		state.engine.options = { ...state.engine.options, url: yield* limitedRole(2).pipe(Effect.provideService(Scope.Scope, state.roleScope)) };
	},
);

export const unownedLeftover = cleanup.trait("configuration", "an earlier run left a database in the older unowned naming format", function* (state) {
	const admin = state.engine.admin;
	state.leftover = `effect_test_${yield* databaseId}`;
	yield* admin`create database ${admin(state.leftover)}`;
	yield* dropOnStoryEnd(state, state.leftover);
});

export const otherHostDatabase = cleanup.trait(
	"configuration",
	"a worker on another host, whose process id is not running here, owns a database",
	function* (state) {
		const admin = state.engine.admin;
		const { stdout: pid } = yield* Effect.promise(() => run(process.execPath, ["--eval", "process.stdout.write(String(process.pid))"]));
		state.otherHost = `effect_test_00000000_${pid}_${yield* databaseId}`;
		yield* admin`create database ${admin(state.otherHost)}`;
		yield* dropOnStoryEnd(state, state.otherHost);
	},
);

export const crashedRun = cleanup.trait(
	"configuration",
	"a worker on this host exited without closing its run, leaving its databases",
	function* (state) {
		const { stdout } = yield* Effect.promise(() =>
			run(process.execPath, ["--conditions=@shivaedev/source", fileURLToPath(new URL("./crashedDatabase.ts", import.meta.url))]),
		);
		const admin = state.engine.admin;
		const owner = stdout.slice(0, stdout.lastIndexOf("_") + 1);
		const rows = yield* admin<{ datname: string }>`select datname from pg_database where starts_with(datname, ${owner}) order by datname`;
		state.crashed = { all: rows.map(({ datname }) => datname), shared: stdout };
		for (const name of state.crashed.all) {
			yield* dropOnStoryEnd(state, name);
		}
	},
);
