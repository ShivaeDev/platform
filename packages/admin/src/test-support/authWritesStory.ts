import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { answered } from "#test/answers.ts";
import { authWritesHost } from "#test/authWritesHost.ts";
import { postgresConfigured, postgresLayer } from "#test/jobsEngine.ts";

type Engine = Effect.Success<typeof authWritesHost>;
type List = "sessions" | "users";

const authCall = Effect.fnUntraced(function* (engine: Engine, person: string, path: string, body: object) {
	const response = yield* Effect.promise(() =>
		fetch(`${engine.baseUrl}/api/auth/${path}`, {
			body: JSON.stringify(body),
			headers: { "content-type": "application/json", cookie: engine.cookies.get(person) ?? "", origin: engine.baseUrl },
			method: "POST",
		}),
	);
	yield* Effect.promise(() => response.text());
	const cookie = response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	if (cookie !== "") {
		engine.cookies.set(person, cookie);
	}
	return response.status;
});

function credentials(person: string) {
	return { email: `${person}@app.test`, password: `${person}-auth-writes-password` };
}

function names(engine: Engine, list: List) {
	return list === "users"
		? AtomRegistry.getResult(engine.registry, engine.users).pipe(Effect.map(({ users }) => users.map(({ name }) => name)))
		: AtomRegistry.getResult(engine.registry, engine.sessions).pipe(Effect.map(({ sessions }) => sessions.map(({ user }) => user.name)));
}

function atomOf(engine: Engine, list: List): Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>> {
	return list === "users" ? engine.users : engine.sessions;
}

export const authWritesStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => authWritesHost,
	layer: postgresLayer,
	name: "admin lists after Better Auth writes",
	runIf: postgresConfigured,
	stages: ["accounts", "page"],
	verbs: (engine, story) => {
		const before = new Map<List, unknown>();
		function writes(line: string, write: Effect.Effect<number>) {
			story.tell(line);
			for (const list of ["users", "sessions"] as const) {
				before.set(list, engine.registry.get(atomOf(engine, list)));
			}
			return write;
		}
		return {
			changesName: (person: string, name: string) =>
				writes(`${person} renames themself ${name} through Better Auth`, authCall(engine, person, "update-user", { name })),
			shown: (list: List) => answered(names(engine, list)),
			signsIn: (person: string) => writes(`${person} signs in through Better Auth`, authCall(engine, person, "sign-in/email", credentials(person))),
			signsOut: (person: string) => writes(`${person} signs out through Better Auth`, authCall(engine, person, "sign-out", {})),
			signsUp: (person: string) =>
				writes(`${person} signs up through Better Auth`, authCall(engine, person, "sign-up/email", { ...credentials(person), name: person })),
			untilRefreshed: (list: List) => {
				story.tell(`the open ${list} list receives the change`);
				return until(
					AtomRegistry.toStream(engine.registry, atomOf(engine, list)),
					(result) => result !== before.get(list) && !AsyncResult.isInitial(result) && !result.waiting,
					{ name: `refreshed ${list} list` },
				);
			},
		};
	},
});

export const bobSignedOut = authWritesStory.trait("accounts", "bob signed up and signed out again", function* (engine) {
	yield* authCall(engine, "bob", "sign-up/email", { ...credentials("bob"), name: "bob" });
	yield* authCall(engine, "bob", "sign-out", {});
});

export const listsOpen = authWritesStory.trait("page", "an admin has the live users and sessions lists open", function* (engine) {
	engine.registry.mount(engine.users);
	engine.registry.mount(engine.sessions);
	yield* until(AtomRegistry.toStream(engine.registry, engine.transport.api[LiveConnection].status), (status) => status.connection === "live", {
		name: "live admin lists",
	});
	yield* AtomRegistry.getResult(engine.registry, engine.users);
	yield* AtomRegistry.getResult(engine.registry, engine.sessions);
});
