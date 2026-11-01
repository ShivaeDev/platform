import { ConfigProvider, type Duration, Effect, Exit, Layer, Predicate, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import type { Key } from "@shivaedev/changes/keys.ts";
import { signInAgain } from "@shivaedev/identity/server/better-auth/testing.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makeAuth } from "#client/auth.ts";
import type { Note } from "#modules/notes/notes.ts";
import { CountWords } from "#modules/notes/server/jobs.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { authPost, credentials } from "#test-support/authHttp.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { sessionPrecondition } from "#test-support/sessionPrecondition.ts";
import type { Account, Engine } from "./Engine.ts";
import { changeHints, watchedList, watchedNote } from "./live.ts";
import { foreignOriginRequest, notesRequests, signOutOver } from "./requests.ts";

export function runningHost(engine: Engine) {
	if (engine.host === undefined) {
		throw new Error("The app host has not started");
	}
	return engine.host;
}

function account(engine: Engine, name: string): Account {
	const found = engine.accounts.get(name);
	if (found === undefined) {
		throw new Error(`${name} has no account; give the story signedIn("${name}")`);
	}
	return found;
}

function liveAddress(engine: Engine) {
	if (engine.live === undefined) {
		throw new Error("The app host has not started");
	}
	return engine.live;
}

function sessionCookieWords(cookies: readonly string[]) {
	const session = cookies.find((cookie) => cookie.includes("better-auth.session_token="));
	if (session === undefined) {
		return "without a session cookie";
	}
	return session.startsWith("__Secure-") && /; Secure(?:;|$)/iv.test(session) ? "with a secure session cookie" : "with a plain session cookie";
}

function signedUpUserId(body: string) {
	const parsed: unknown = JSON.parse(body);
	return Predicate.hasProperty(parsed, "user") && Predicate.hasProperty(parsed.user, "id") && typeof parsed.user.id === "string"
		? parsed.user.id
		: "";
}

function enqueueFailure(message: unknown) {
	const event = Array.isArray(message)
		? message.find((entry) => Predicate.hasProperty(entry, "event") && entry.event === "note_enqueue_failed")
		: undefined;
	if (!(Predicate.hasProperty(event, "noteId") && Predicate.hasProperty(event, "error") && Predicate.hasProperty(event.error, "queue"))) {
		return [];
	}
	return [{ noteId: event.noteId, queue: event.error.queue }];
}

export function applicationVerbs(engine: Engine, story: { tell: (line: string) => void }) {
	engine.tell = story.tell;
	engine.sourceApi.narrate(story.tell);
	function describeKey(key: Key) {
		const owner = [...engine.accounts].find(([, { userId }]) => key._tag === "Bucket" && key.value === userId)?.[0];
		if (owner !== undefined) {
			return `${owner}'s notes`;
		}
		return key._tag === "Item" ? `note ${key.id}` : `${key.collection} ${key._tag.toLowerCase()}`;
	}
	const renewSession = Effect.fn("AppStory.renewSession")(function* (name: string) {
		const host = runningHost(engine);
		const auth = yield* sessionPrecondition(host);
		const { headers } = yield* signInAgain(auth, account(engine, name).userId);
		const cookie = headers.get("cookie") ?? "";
		engine.accounts.set(name, { ...account(engine, name), cookie, notes: yield* notesRequests(host, name, cookie, story.tell) });
	});
	const startWorker = Effect.fn("AppStory.startWorker")(function* () {
		const database = yield* PostgresTestDatabase;
		const jobs = makePgBossTesting();
		const worker = applicationWorker({
			databaseUrl: database.url,
			poolSizes: testPoolSizes,
			replacements: Layer.succeed(JobsClientFactory, jobs.clientFactory),
		});
		const env = engine.traces === undefined ? {} : { "OTEL_BSP_SCHEDULE_DELAY": "100", "OTEL_EXPORTER_OTLP_ENDPOINT": engine.traces.url };
		const scope = yield* Scope.fork(yield* Scope.Scope);
		yield* Layer.buildWithScope(worker.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))), scope);
		engine.worker = { jobs, stop: Scope.close(scope, Exit.void) };
		return engine.worker;
	});
	function traces() {
		if (engine.traces === undefined) {
			throw new Error("The worker exports no traces; give the story workerExportsTraces()");
		}
		return engine.traces;
	}
	return {
		authClientSession: (name: string) =>
			Effect.promise(async () => {
				story.tell(`${name}'s auth client reads her session from the app host`);
				const { baseUrl, origin } = runningHost(engine);
				const auth = makeAuth({ baseUrl, fetchOptions: { headers: { cookie: account(engine, name).cookie, origin } } });
				const { data } = await auth.client.getSession();
				if (data === null) {
					return "no session";
				}
				const owner = [...engine.accounts].find(([, { userId }]) => userId === data.user.id)?.[0] ?? "another account";
				return { account: owner, email: data.user.email };
			}),
		exportedSpans: (spanName: string) =>
			Effect.sync(() =>
				traces()
					.spans.filter((span) => span.name === spanName)
					.map((span) => (span.status.code === 2 ? "error" : "ok")),
			),
		exportedTraceMentions: (text: string) =>
			Effect.sync(() => (traces().requests.some(({ body }) => body.toString().includes(text)) ? `mentions ${text}` : `never mentions ${text}`)),
		foreignOriginCalls: (name: string) => {
			story.tell(`a page on a foreign origin calls protected RPC with ${name}'s cookie`);
			return foreignOriginRequest(runningHost(engine), account(engine, name).cookie);
		},
		listensForChangeHints: (name: string) => {
			story.tell(`${name}'s socket listens for change hints on her notes list`);
			return changeHints(liveAddress(engine), account(engine, name).cookie, describeKey);
		},
		noteCommitsRecover: Effect.fn("AppStory.noteCommitsRecover")(function* () {
			story.tell("PostgreSQL accepts note commits again");
			const sql = yield* SqlClient.SqlClient;
			yield* sql`drop trigger reject_note_commit on notes`;
		}),
		noteReadsLoseTheDatabase: Effect.fn("AppStory.noteReadsLoseTheDatabase")(function* () {
			story.tell("PostgreSQL loses its connection for note reads while sessions stay readable");
			const sql = yield* SqlClient.SqlClient;
			yield* sql`alter table notes rename to available_notes`;
			yield* sql`create function unavailable_notes() returns setof available_notes language plpgsql as $$begin raise exception 'connection lost' using errcode = '08006'; end$$`;
			yield* sql`create view notes as select * from unavailable_notes()`;
		}),
		notesOf: (name: string) => account(engine, name).notes,
		queueRefusesNextWordCount: Effect.fn("AppStory.queueRefusesNextWordCount")(function* () {
			story.tell("the queue refuses the next word-count job");
			yield* runningHost(engine).jobsTesting.failNextSend(CountWords);
		}),
		recordedEnqueueFailures: () =>
			Effect.sync(() => {
				story.tell("read the enqueue failures the app host logged");
				return runningHost(engine).logs.flatMap(({ message }) => enqueueFailure(message));
			}),
		signsInAgain: (name: string) => {
			story.tell(`${name} signs in again`);
			return renewSession(name);
		},
		signsOut: (name: string) => {
			story.tell(`${name} signs out`);
			return signOutOver(runningHost(engine), account(engine, name).cookie);
		},
		signsOutThroughAuthClient: (name: string) =>
			Effect.promise(async () => {
				story.tell(`${name} signs out through her auth client`);
				const { baseUrl, origin } = runningHost(engine);
				const auth = makeAuth({ baseUrl, fetchOptions: { headers: { cookie: account(engine, name).cookie, origin } } });
				const { error } = await auth.client.signOut();
				if (error !== null) {
					throw new Error(`Sign-out failed: ${error.message}`);
				}
			}),
		signsUp: Effect.fn("AppStory.signsUp")(function* (name: string) {
			story.tell(`${name} signs up with her email and password`);
			const host = runningHost(engine);
			const response = yield* authPost(host.baseUrl, "sign-up/email", credentials(name), "", host.origin);
			if (response.status !== HttpStatus.fromLiteral("OK")) {
				return `refused with HTTP ${response.status}`;
			}
			engine.accounts.set(name, {
				cookie: response.cookie,
				notes: yield* notesRequests(host, name, response.cookie, story.tell),
				userId: signedUpUserId(response.body),
			});
			return `signed up ${sessionCookieWords(response.cookies)}`;
		}),
		sourceRequests: () => engine.sourceApi.requests.map(({ method, path, status }) => ({ method, path, status })),
		timePasses: (duration: Duration.Input) => {
			story.tell(`${duration} pass`);
			return TestClock.adjust(duration);
		},
		visitorNotes: () => notesRequests(runningHost(engine), "a signed-out visitor", "", story.tell),
		watchesNote: (name: string, note: Pick<Note, "id" | "title">) => {
			story.tell(`${name} opens ${JSON.stringify(note.title)} on a live socket`);
			return watchedNote(liveAddress(engine), account(engine, name).cookie, note.id);
		},
		watchesNotes: (name: string) => {
			story.tell(`${name} opens her notes list on a live socket`);
			return watchedList(liveAddress(engine), account(engine, name).cookie);
		},
		wordCountJobs: Effect.fn("AppStory.wordCountJobs")(function* () {
			story.tell("read the word-count jobs in the queue");
			const jobs = yield* runningHost(engine).jobsTesting.jobs(CountWords);
			return jobs.map(({ data, state }) => ({ noteId: data.noteId, state }));
		}),
		workerCountsQueuedNotes: Effect.fn("AppStory.workerCountsQueuedNotes")(function* () {
			story.tell("the word-count worker starts and counts every queued note");
			const { jobs } = yield* startWorker();
			yield* jobs.waitForIdle;
		}),
		workerStarts: Effect.fn("AppStory.workerStarts")(function* () {
			story.tell("the word-count worker starts");
			yield* startWorker();
		}),
		workerStops: () => {
			story.tell("the word-count worker stops and flushes its traces");
			if (engine.worker === undefined) {
				throw new Error("The word-count worker has not started");
			}
			return engine.worker.stop;
		},
	};
}
