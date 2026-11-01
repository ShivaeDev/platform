import { DateTime, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { developmentServer } from "#test-support/developmentServer.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import { applicationVerbs, runningHost } from "./applicationVerbs.ts";
import type { Engine } from "./Engine.ts";
import { notesRequests } from "./requests.ts";

export const app = storyKit({
	after: {
		*hosting(engine) {
			engine.host = yield* startHost(engine.hostOptions);
			engine.live = engine.host;
		},
	},
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const sourceApi = yield* fakeHttpService({
			routes: { post: { path: "/posts/:id", reply: () => ({ body: { title: "A note from outside" } }) } },
		});
		yield* routeOutbound({ "jsonplaceholder.typicode.com": sourceApi.url });
		const engine: Engine = {
			accounts: new Map(),
			host: undefined,
			hostOptions: {},
			live: undefined,
			sourceApi,
			tell: () => undefined,
			traces: undefined,
			worker: undefined,
		};
		return engine;
	},
	inspect: (engine) => ({ accounts: [...engine.accounts.keys()], baseUrl: engine.host?.baseUrl, deployed: engine.hostOptions.deployed ?? false }),
	layer: postgres,
	name: "app",
	stages: ["hosting", "accounts", "development", "notes"],
	verbs: applicationVerbs,
});

export function signedIn(name: string) {
	return app.trait("accounts", `${name} is signed in`, function* (engine) {
		const host = runningHost(engine);
		const { headers, user } = yield* mintUser(host, name);
		const cookie = headers.get("cookie") ?? "";
		engine.accounts.set(name, { cookie, notes: yield* notesRequests(host, name, cookie, engine.tell), userId: user.id });
	});
}

export function behindHttpsProxy(publicUrl: "with PUBLIC_URL" | "without PUBLIC_URL") {
	return app.trait("hosting", `the app runs behind an HTTPS forwarding proxy ${publicUrl}`, (engine) => {
		engine.hostOptions = {
			...engine.hostOptions,
			deployed: true,
			trustedProxy: "127.0.0.1",
			...(publicUrl === "with PUBLIC_URL" ? {} : { publicUrl: "unset" }),
		};
	});
}

export function workerExportsTraces() {
	return app.trait("hosting", "the word-count worker exports its traces to a collector", function* (engine) {
		engine.traces = yield* otlpReceiver();
	});
}

export function throughDevelopmentServer() {
	return app.trait("development", "live notes reach the app through its Vite development server", function* (engine) {
		const { url } = yield* developmentServer(runningHost(engine).baseUrl);
		engine.live = { baseUrl: url, origin: url };
	});
}

export function legacyNote(title: string) {
	return app.trait("notes", `PostgreSQL holds the unowned note ${JSON.stringify(title)} from before notes had owners`, function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into notes (title) values (${title})`;
	});
}

export function noteCommitsFail() {
	return app.trait("notes", "PostgreSQL rejects every note write when it commits", function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create function reject_note_commit() returns trigger language plpgsql as $$
			begin raise exception 'rejected at commit'; end;
		$$`;
		yield* sql`create constraint trigger reject_note_commit after insert on notes
			deferrable initially deferred for each row execute function reject_note_commit()`;
	});
}

export function reservedTitleConstraint() {
	return app.trait("notes", 'a PostgreSQL constraint rejects the title "Reserved"', function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`alter table notes add constraint reserved_title check (title <> 'Reserved')`;
	});
}

export function sourceNoteMissing() {
	return app.trait("hosting", "the source API answers Not Found with a body that looks like a note", function* (engine) {
		yield* engine.sourceApi.scriptFault("post", {
			kind: "status",
			reply: { body: { title: "This error body must not become a note" }, status: HttpStatus.fromLiteral("NotFound") },
		});
	});
}

export function malformedSourceNote() {
	return app.trait("hosting", "the source API answers with a numeric title", function* (engine) {
		yield* engine.sourceApi.scriptFault("post", { kind: "status", reply: { body: { title: 123 } } });
	});
}
