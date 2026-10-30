import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { requests } from "#modules/notes/test-support/requests.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import type { Engine } from "./applicationState.ts";
import { applicationVerbs } from "./applicationVerbs.ts";
import { workerQueue } from "./workerQueue.ts";

export const app = storyKit({
	after: {
		*hosting(engine) {
			engine.host = yield* startHost(engine.hostOptions);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const sourceApi = yield* fakeHttpService({
			routes: { post: { path: "/posts/:id", reply: () => ({ body: { title: "A note from outside" } }) } },
		});
		yield* routeOutbound({ "jsonplaceholder.typicode.com": sourceApi.url });
		const engine: Engine = { actors: new Map(), host: undefined, hostOptions: {}, sourceApi, tell: () => undefined, workerQueue: workerQueue() };
		return engine;
	},
	inspect: (engine) => ({ accounts: [...engine.actors.keys()], baseUrl: engine.host?.baseUrl, deployed: engine.hostOptions.deployed ?? false }),
	layer: postgres,
	name: "app",
	stages: ["hosting", "accounts", "notes"],
	verbs: applicationVerbs,
});

export function signedIn(name = "alice") {
	return app.trait("accounts", `${name} is signed in`, function* (engine) {
		if (engine.host === undefined) {
			return yield* Effect.die("Host has not started");
		}
		const http = requests(engine.host, (line) => engine.tell(line));
		const { headers, user } = yield* mintUser(engine.host, name);
		const cookie = headers.get("cookie") ?? "";
		engine.actors.set(name, { cookie, notes: yield* http.notes(cookie), userId: user.id });
	});
}

export function behindProxy() {
	return app.trait("hosting", "the app is behind an HTTPS forwarding proxy", (engine) => {
		engine.hostOptions = { ...engine.hostOptions, deployed: true, trustedProxy: "127.0.0.1" };
	});
}

export function legacyNote(title: string) {
	return app.trait("notes", `PostgreSQL contains the unowned note ${JSON.stringify(title)}`, function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into notes (title) values (${title})`;
	});
}

export function rejectedNoteCommits() {
	return app.trait("notes", "PostgreSQL rejects note writes at commit", function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create function reject_note_commit() returns trigger language plpgsql as $$
			begin raise exception 'rejected at commit'; end;
		$$`;
		yield* sql`create constraint trigger reject_note_commit after insert on notes
			deferrable initially deferred for each row execute function reject_note_commit()`;
	});
}

export function sourceNoteMissing() {
	return app.trait("hosting", "the source API cannot find the note", function* (engine) {
		yield* engine.sourceApi.scriptFault("post", {
			kind: "status",
			reply: { body: { title: "This error body must not become a note" }, status: HttpStatus.fromLiteral("NotFound") },
		});
	});
}

export function malformedSourceNote() {
	return app.trait("hosting", "the source API returns a malformed note", function* (engine) {
		yield* engine.sourceApi.scriptFault("post", { kind: "status", reply: { body: { title: 123 } } });
	});
}

export function constrainedTitles() {
	return app.trait("notes", "PostgreSQL rejects the reserved title", function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`alter table notes add constraint reserved_title check (title <> 'Reserved')`;
	});
}
