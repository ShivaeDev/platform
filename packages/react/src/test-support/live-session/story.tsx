import { Clock, Effect, Fiber, Stream } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { App } from "./App.tsx";
import type { connect } from "./connect.ts";
import { sessionCookie } from "./cookie.ts";
import { openHost } from "./openHost.ts";
import { shell } from "./shell.tsx";

type Host = Awaited<ReturnType<typeof openHost>>;

function registryState(registry: AtomRegistry.AtomRegistry) {
	return registry.getNodes().size > 0 ? "holds atoms" : "empty";
}

function settled(host: Host, view: Rendered) {
	const notes = [...view.container.querySelectorAll("output")];
	return notes.every((note) => note.dataset.live === "live" && note.dataset.pending === "false") && notes.length === host.state.active.length;
}

function noteGoesLive(host: Host, view: Rendered, tell: (line: string) => void) {
	return settleScreen(view.container, () => view.container.querySelector("output") === null || !settled(host, view), tell);
}

function revoke(host: Host, rechecked: readonly (string | undefined)[], screen: Screen, view: Rendered) {
	const before = rechecked.length;
	return Effect.sync(() => {
		screen.tell("the server revokes alice's session and her stream revalidation rechecks it");
		host.state.session = undefined;
	}).pipe(
		Effect.andThen(untilTimer("100 millis")),
		Effect.andThen(
			Effect.gen(function* () {
				const run = Effect.runPromiseWith(yield* Effect.context());
				yield* screen.act("the stream revalidation interval passes", () => run(TestClock.adjust("100 millis")));
			}),
		),
		Effect.andThen(settleScreen(view.container, () => rechecked.length === before || !settled(host, view), screen.tell)),
	);
}

const renameNote = Effect.fnUntraced(function* (host: Host, title: string, answer: Effect.Effect<unknown>) {
	const answered = yield* Effect.forkChild(answer);
	yield* Effect.promise(() => host.rename(title));
	yield* Effect.raceFirst(
		Fiber.join(answered),
		untilTimer("500 millis").pipe(Effect.andThen(TestClock.adjust("500 millis")), Effect.andThen(Fiber.join(answered))),
	);
});

export const liveSessionStory = storyKit({
	clock: "test",
	*create() {
		const clock = yield* Clock.Clock;
		const runtime = yield* storyRuntime;
		const host = yield* Effect.acquireRelease(
			Effect.promise(() => openHost(clock)),
			(value) => Effect.promise(value.close),
		);
		window.location.href = host.url;
		const screen = new Screen(() => undefined);
		const rechecked: Array<string | undefined> = [];
		const registries: AtomRegistry.AtomRegistry[] = [];
		const clients: ReturnType<typeof connect>[] = [];
		const run = Effect.runPromiseWith(yield* Effect.context());
		const view = yield* screen.open(
			<App
				connected={(registry, client) => {
					registries.push(registry);
					clients.push(client);
				}}
				rechecked={() => {
					rechecked.push(host.state.session);
				}}
				runtime={runtime}
				session={() => host.state.session}
				signIn={() => {
					host.state.session = "alice";
				}}
				url={host.url}
			/>,
		);
		yield* noteGoesLive(host, view, screen.tell);
		return { clients, host, rechecked, registries, run, screen, view };
	},
	inspect: ({ host, view }) => ({ ...host.state, html: view.container.innerHTML }),
	name: "live session",
	stages: ["screen"],
	verbs: ({ clients, host, rechecked, registries, run, screen, view }, story) => {
		screen.tell = story.tell;
		function nextAnswer() {
			const registry = registries.at(-1);
			const client = clients.at(-1);
			if (registry === undefined || client === undefined) {
				throw new Error("No open note");
			}
			return AtomRegistry.toStream(registry, client.get.query(undefined)).pipe(
				Stream.drop(1),
				Stream.filter((result: AsyncResult.AsyncResult<string, unknown>) => !result.waiting),
				Stream.runHead,
			);
		}
		return {
			allowRead: () =>
				Effect.sync(() => {
					story.tell("the server grants alice read access to the note");
					host.state.allowed = true;
				}),
			denyRead: () =>
				Effect.sync(() => {
					story.tell("the server stops letting alice read the note");
					host.state.allowed = false;
				}),
			reads: () => Effect.sync(() => host.state.reads),
			// The query's Unauthorized effect and the live connection's failure listener may both report one revocation.
			recheckedSessions: () => Effect.sync(() => [...new Set(rechecked)].map((session) => session ?? "signed out")),
			registries: () => Effect.sync(() => registries.map(registryState)),
			rename: (title: string) =>
				screen.act(`the server renames the note to ${title} and the open note answers the change hint`, () =>
					run(renameNote(host, title, nextAnswer()).pipe(Effect.orDie)),
				),
			revokeSession: () => revoke(host, rechecked, screen, view),
			shown: () => Effect.sync(() => view.container.textContent),
			signIn: () =>
				screen
					.driver(view.container)
					.click({ name: "Sign in", role: "button" })
					.pipe(Effect.andThen(noteGoesLive(host, view, screen.tell))),
			subscribers: () => Effect.sync(() => [...host.state.active]),
		};
	},
});

export function aliceSessionRevoked() {
	return liveSessionStory.trait("screen", "the server revoked alice's session and her screen shows Sign in", ({ host, rechecked, screen, view }) =>
		revoke(host, rechecked, screen, view),
	);
}

type User = "alice" | "bob";

interface Session {
	readonly id: string;
	readonly token: string;
}

type Credential = "cookie" | "bearer";

interface ScopedEngine {
	credential: Credential;
	current: Session | undefined;
	readonly host: Host;
	readonly runtime: Atom.RuntimeFactory;
	readonly screen: Screen;
	shell: ReturnType<typeof shell>;
	readonly signIns: Record<User, number>;
	readonly view: Rendered;
}

function scopedVerbs(engine: ScopedEngine) {
	const { host, screen, view } = engine;
	function show(line: string, session: Session | undefined) {
		engine.current = session;
		return Effect.gen(function* () {
			if (engine.credential === "cookie") {
				yield* sessionCookie(session?.token);
			}
			yield* screen.act(line, () => engine.shell.show(session));
			yield* settleScreen(view.container, () => !settled(host, view), screen.tell);
		});
	}
	function connection(id: string) {
		const found = engine.shell.connections.find((candidate) => candidate.id === id);
		if (found === undefined) {
			throw new Error(`Session ${id} never connected`);
		}
		return found;
	}
	function signIn(user: User) {
		engine.signIns[user] += 1;
		const id = `${user}-${engine.signIns[user]}`;
		return show(`${user} signs in as session ${id}`, { id, token: `${user}-token` });
	}
	return {
		connections: () => Effect.sync(() => engine.shell.connections.map(({ id }) => id)),
		heldAtoms: (id: string) => Effect.sync(() => registryState(connection(id).registry)),
		renameAlicesNote: (title: string) => screen.act(`the server renames alice's note to ${title}`, () => host.rename(title)),
		sameRegistry: (left: string, right: string) => Effect.sync(() => connection(left).registry === connection(right).registry),
		showAgain: () => show(`show ${engine.current?.id ?? "the signed-out screen"} again`, engine.current),
		shown: () => Effect.sync(() => view.container.textContent),
		signIn,
		signOut: () => show("sign out", undefined),
		subscribers: () => Effect.sync(() => [...host.state.active]),
	};
}

export const privateNotes = storyKit({
	clock: "test",
	*create() {
		const clock = yield* Clock.Clock;
		const runtime = yield* storyRuntime;
		const host = yield* Effect.acquireRelease(
			Effect.promise(() => openHost(clock)),
			(value) => Effect.promise(value.close),
		);
		window.location.href = host.url;
		const screen = new Screen(() => undefined);
		const view = yield* screen.open();
		const engine: ScopedEngine = {
			credential: "bearer",
			current: undefined,
			host,
			runtime,
			screen,
			shell: shell(host.url, view, false, runtime),
			signIns: { alice: 0, bob: 0 },
			view,
		};
		return engine;
	},
	inspect: ({ credential, host, view }) => ({ ...host.state, credential, html: view.container.innerHTML }),
	name: "session-owned private notes over a WebSocket",
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		return scopedVerbs(engine);
	},
});

export function signedInPrivately(credential: Credential, users: readonly User[]) {
	return privateNotes.trait(
		"screen",
		`${users.join(", then ")} signed in over a ${credential} WebSocket and saw their private note`,
		function* (engine) {
			engine.credential = credential;
			if (credential === "cookie") {
				engine.shell = shell(engine.host.url, engine.view, true, engine.runtime);
				yield* Effect.addFinalizer(() => sessionCookie());
			}
			const verbs = scopedVerbs(engine);
			for (const user of users) {
				yield* verbs.signIn(user);
			}
		},
	);
}
