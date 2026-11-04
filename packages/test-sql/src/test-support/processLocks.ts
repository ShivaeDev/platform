import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#server/database.ts";
import { waitForBlockedSessions } from "#server/waitForBlockedSessions.ts";
import { waitForHeldLock } from "#server/waitForHeldLock.ts";
import { withIsolatedDatabase } from "#server/withIsolatedDatabase.ts";
import { lockProcess } from "./lockProcess.ts";
import { adminUrl, configured, secondClient, setup } from "./postgres.ts";

type Actor = "alice" | "bob";
type Process = Effect.Success<ReturnType<typeof lockProcess>>;
type Database = "story database" | "another database";

export const processLocks = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => Effect.succeed({ processes: new Map<Actor, Process>() }),
	inspect: ({ processes }) => ({ processes: [...processes.keys()] }),
	layer: setup().layer,
	name: "cross-process locks",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => {
		function actor(name: Actor) {
			const process = engine.processes.get(name);
			if (process === undefined) {
				throw new Error(`${name} has not launched`);
			}
			return process;
		}
		function owners(rows: readonly { readonly pid: number }[]) {
			return rows.map(({ pid }) => [...engine.processes].find(([, process]) => process.pid === pid)?.[0] ?? `unknown backend ${pid}`);
		}
		return {
			blockedBehind: (name: Actor) => {
				story.tell(`the story waits for sessions blocked behind ${name}`);
				return waitForBlockedSessions(actor(name).pid).pipe(Effect.map(owners));
			},
			heldBy: (key: string, name?: Actor, database: Database = "story database") =>
				Effect.gen(function* () {
					story.tell(`the story waits for ${key} to be held in ${database}${name === undefined ? "" : ` by ${name}`}`);
					const sql = database === "story database" ? yield* SqlClient.SqlClient : yield* secondClient(adminUrl);
					return yield* waitForHeldLock(key, name === undefined ? undefined : { applicationName: name }).pipe(
						Effect.provideService(SqlClient.SqlClient, sql),
						Effect.map(owners),
					);
				}),
			launch: (name: Actor, key: string, database: Database = "story database") =>
				Effect.gen(function* () {
					story.tell(`${name} launches a process that will take ${key} in ${database}`);
					const url = database === "story database" ? (yield* PostgresTestDatabase).url : adminUrl;
					engine.processes.set(name, yield* lockProcess(url, key, name));
				}),
			missingLock: (key: string, name?: Actor) => {
				story.tell(`the story bounds its wait for ${key}${name === undefined ? "" : ` held by ${name}`}`);
				return waitForHeldLock(key, {
					...(name === undefined ? {} : { applicationName: name }),
					clock: "test",
					every: "1 second",
					within: "2 seconds",
				}).pipe(
					Effect.map(owners),
					Effect.catchTag("NeverSettled", () => Effect.succeed("lock was not held")),
				);
			},
			takeLock: (name: Actor) => {
				story.tell(`${name} asks its process to take its lock`);
				return actor(name).take;
			},
		};
	},
});
