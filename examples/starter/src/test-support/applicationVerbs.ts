import { ConfigProvider, Effect, Exit, Layer, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { makeAuth } from "#client/auth.ts";
import { CountWords } from "#server/noteJobs.ts";
import { noteWorker } from "#server/noteWorker.ts";
import type { Engine } from "./applicationState.ts";
import { authPost, credentials } from "./authHttp.ts";
import { createInRolledBackTransaction } from "./createInRolledBackTransaction.ts";
import { startHost } from "./host.ts";
import { liveNotes } from "./liveNotes.ts";
import { requests } from "./requests.ts";
import { sessionPrecondition } from "./sessionPrecondition.ts";
import { storedNotes } from "./storedNotes.ts";
import { workerTracing } from "./workerTracing.ts";

export function applicationVerbs(engine: Engine, story: { tell: (line: string) => void }) {
	function host() {
		if (engine.host === undefined) {
			throw new Error("Host has not started");
		}
		return engine.host;
	}
	engine.tell = story.tell;
	function http() {
		return requests(host(), story.tell);
	}
	const startWorker = Effect.fn("AppStory.startWorker")(function* (env?: Record<string, string>) {
		story.tell("start the word-count worker");
		const database = yield* PostgresTestDatabase;
		const worker = noteWorker({ clientFactory: engine.workerQueue.clientFactory, databaseUrl: database.url });
		const scope = yield* Scope.fork(yield* Scope.Scope);
		yield* Layer.buildWithScope(
			env === undefined ? worker : worker.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))),
			scope,
		);
		return Effect.suspend(() => {
			story.tell("stop the word-count worker");
			return Scope.close(scope, Exit.void);
		});
	});
	return {
		awaitDatabaseCleanup: () => engine.databaseLifetime.awaitCleanup,
		...storedNotes(story.tell),
		databaseLifetime: () => engine.databaseLifetime,
		existingNote: (title: string) => {
			const note = engine.existingNotes.get(title);
			if (note === undefined) {
				throw new Error(`No existing note ${title}`);
			}
			return note;
		},
		...workerTracing(story.tell, startWorker),
		acceptNoteCommits: Effect.gen(function* () {
			story.tell("PostgreSQL accepts note commits again");
			const sql = yield* SqlClient.SqlClient;
			yield* sql`drop trigger reject_note_commit on notes`;
		}),
		actor: (name = "alice") => {
			const actor = engine.actors.get(name);
			if (actor === undefined) {
				throw new Error(`No signed-in account ${name}`);
			}
			return actor;
		},
		anonymous: () => http().notes(),
		authClient: (cookie = "") => {
			story.tell("connect an auth client to this story's app host");
			const { baseUrl, origin } = host();
			return makeAuth({ baseUrl, fetchOptions: { headers: { cookie, origin } } });
		},
		authenticateResponse: (name: string, path: string) => authPost(host().baseUrl, path, credentials(name), "", host().origin),
		createInRolledBackTransaction: (title: string, ownerId: string) => createInRolledBackTransaction(host(), story.tell, title, ownerId),
		failNextNoteJob: Effect.fn("AppStory.failNextNoteJob")(function* () {
			story.tell("the queue client rejects the next word-count send");
			yield* host().jobsTesting.failNextSend(CountWords);
		}),
		foreignRequest: (cookie: string) => http().foreignRequest(cookie),
		liveNotes: (name = "alice") => {
			story.tell(`${name} watches the live notes list`);
			const actor = engine.actors.get(name);
			if (actor === undefined) {
				throw new Error(`No signed-in account ${name}`);
			}
			return liveNotes(host(), actor.cookie);
		},
		logs: () => host().logs,
		mintSession: Effect.fn("AppStory.mintSession")(function* (name: string) {
			story.tell(`mint a new session for ${name}'s existing account`);
			const actor = engine.actors.get(name);
			if (actor === undefined) {
				return yield* Effect.die(`No account ${name}`);
			}
			const auth = yield* sessionPrecondition(host());
			const { test } = yield* Effect.promise(() => auth.$context);
			const { headers } = yield* Effect.promise(() => test.login({ userId: actor.userId }));
			return headers.get("cookie") ?? "";
		}),
		notes: (cookie: string) => http().notes(cookie),
		rerunMigrations: Effect.fn("AppStory.rerunMigrations")(function* () {
			story.tell("run the deployment migrations and open another app host");
			engine.host = yield* startHost(engine.hostOptions);
		}),
		runningHost: host,
		signOut: (cookie: string) => http().signOut(cookie),
		startWorker,
		wordCountCompletions: engine.workerQueue.completions,
	};
}
