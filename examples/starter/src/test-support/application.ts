import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { makeAuth } from "#client/auth.ts";
import { noteWorker } from "#server/noteWorker.ts";
import { type RunningHost, startHost } from "./host.ts";
import { liveNotes } from "./liveNotes.ts";
import { postgres } from "./postgres.ts";
import { requests } from "./requests.ts";

interface Actor {
	readonly cookie: string;
	readonly notes: Effect.Success<ReturnType<ReturnType<typeof requests>["notes"]>>;
}

interface Engine {
	actors: Map<string, Actor>;
	deployed: boolean;
	host: RunningHost | undefined;
	tell: (line: string) => void;
}

export const app = storyKit({
	after: {
		*hosting(engine) {
			engine.host = yield* startHost(engine.deployed);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): Engine => ({ actors: new Map(), deployed: false, host: undefined, tell: () => undefined }),
	inspect: (engine) => ({ accounts: [...engine.actors.keys()], baseUrl: engine.host?.baseUrl, deployed: engine.deployed }),
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
				story.tell("run the deployment migrations and open another app host");
				engine.host = yield* startHost(engine.deployed);
			}),
			runningHost: host,
			startWorker: Effect.fn("StarterStory.startWorker")(function* () {
				story.tell("start the word-count worker");
				const database = yield* PostgresTestDatabase;
				yield* Layer.build(noteWorker({ databaseUrl: database.url }));
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

export function behindProxy() {
	return app.trait("hosting", "the app is behind an HTTPS forwarding proxy", (engine) => {
		engine.deployed = true;
	});
}

export function legacyNote(title: string) {
	return app.trait("notes", `PostgreSQL contains the unowned note ${JSON.stringify(title)}`, function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into starter_notes (title) values (${title})`;
	});
}
