import { ConfigProvider, Effect, Exit, Layer, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makeAuth } from "#client/auth.ts";
import { CountWords } from "#modules/notes/server/jobs.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { authPost, credentials } from "#test-support/authHttp.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { sessionPrecondition } from "#test-support/sessionPrecondition.ts";
import type { Engine } from "./applicationState.ts";
import { liveNotes } from "./live.ts";
import { requests } from "./requests.ts";
import { rpcProfile } from "./rpcProfile.ts";
import { storedNotes } from "./stored.ts";
import { workerTracing } from "./workerTracing.ts";

export function applicationVerbs(engine: Engine, story: { tell: (line: string) => void }) {
	function host() {
		if (engine.host === undefined) {
			throw new Error("Host has not started");
		}
		return engine.host;
	}
	engine.tell = story.tell;
	engine.sourceApi.narrate(story.tell);
	function http() {
		return requests(host(), story.tell);
	}
	const startWorker = Effect.fn("AppStory.startWorker")(function* (env?: Record<string, string>) {
		story.tell("start the word-count worker");
		const database = yield* PostgresTestDatabase;
		const worker = applicationWorker({
			databaseUrl: database.url,
			poolSizes: testPoolSizes,
			replacements: Layer.succeed(JobsClientFactory, engine.workerQueue.clientFactory),
		});
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
		...storedNotes(story.tell),
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
		profile: (cookie: string) => {
			story.tell("read the session profile through the bound RPC client");
			return rpcProfile(host(), cookie);
		},
		runningHost: host,
		signOut: (cookie: string) => http().signOut(cookie),
		sourceRequests: () => engine.sourceApi.requests.map(({ method, path, status }) => ({ method, path, status })),
		startWorker,
		wordCountCompletions: engine.workerQueue.completions,
	};
}
