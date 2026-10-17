import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { makeAuth } from "#client/auth.ts";
import { noteWorker } from "#server/noteWorker.ts";
import { authRateLimits } from "./authRateLimits.ts";
import { type HostOptions, type RunningHost, secret, startHost } from "./host.ts";
import { liveNotes } from "./liveNotes.ts";
import { postgres } from "./postgres.ts";
import { requests } from "./requests.ts";

interface Actor {
	readonly cookie: string;
	readonly notes: Effect.Success<ReturnType<ReturnType<typeof requests>["notes"]>>;
}

interface Engine {
	actors: Map<string, Actor>;
	host: RunningHost | undefined;
	hostOptions: HostOptions;
	tell: (line: string) => void;
}

export const app = storyKit({
	after: {
		*hosting(engine) {
			engine.host = yield* startHost(engine.hostOptions);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): Engine => ({ actors: new Map(), host: undefined, hostOptions: {}, tell: () => undefined }),
	inspect: (engine) => ({ accounts: [...engine.actors.keys()], baseUrl: engine.host?.baseUrl, deployed: engine.hostOptions.deployed ?? false }),
	layer: postgres,
	name: "starter",
	stages: ["hosting", "accounts", "notes"],
	verbs: (engine, story) => {
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
		return {
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
			authenticate: (name: string, path?: string, cookie?: string) => http().authenticate(name, path, cookie),
			authRateLimits: () => authRateLimits(host(), story.tell),
			foreignRequest: (cookie: string) => http().foreignRequest(cookie),
			liveNotes: (name = "alice") => {
				story.tell(`${name} watches the live notes list`);
				const actor = engine.actors.get(name);
				if (actor === undefined) {
					throw new Error(`No signed-in account ${name}`);
				}
				return liveNotes(host(), actor.cookie);
			},
			notes: (cookie: string) => http().notes(cookie),
			rerunMigrations: Effect.fn("StarterStory.rerunMigrations")(function* () {
				story.tell("open another app host and rerun its migrations");
				engine.host = yield* startHost(engine.hostOptions);
			}),
			runningHost: host,
			startWorker: Effect.fn("StarterStory.startWorker")(function* () {
				story.tell("start the word-count worker");
				const database = yield* PostgresTestDatabase;
				yield* Layer.build(noteWorker({ databaseUrl: database.url, secret }));
			}),
		};
	},
});

export function signedIn(name = "alice") {
	return app.trait("accounts", `${name} is signed in`, function* (engine) {
		if (engine.host === undefined) {
			return yield* Effect.die("Host has not started");
		}
		const http = requests(engine.host, (line) => engine.tell(line));
		const cookie = yield* http.authenticate(name);
		engine.actors.set(name, { cookie, notes: yield* http.notes(cookie) });
	});
}

export function behindProxy(options: { readonly trustedProxy?: string | undefined } = { trustedProxy: "127.0.0.1" }) {
	return app.trait("hosting", "the app is behind an HTTPS forwarding proxy", (engine) => {
		engine.hostOptions = { ...engine.hostOptions, deployed: true, ...options };
	});
}

export function authRateLimiting(enabled: boolean) {
	return app.trait("hosting", `auth rate limiting is ${enabled ? "enabled" : "disabled"}`, (engine) => {
		engine.hostOptions = { ...engine.hostOptions, rateLimitEnabled: enabled };
	});
}

export function legacyNote(title: string) {
	return app.trait("notes", `PostgreSQL contains the unowned note ${JSON.stringify(title)}`, function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into starter_notes (title) values (${title})`;
	});
}
