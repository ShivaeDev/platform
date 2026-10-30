import { Effect, Fiber, Stream } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
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
	}).pipe(Effect.andThen(settleScreen(view.container, () => rechecked.length === before || !settled(host, view), screen.tell)));
}

export const liveSessionStory = storyKit({
	clock: "live",
	*create() {
		const host = yield* Effect.acquireRelease(Effect.promise(openHost), (value) => Effect.promise(value.close));
		window.location.href = host.url;
		const screen = new Screen(() => undefined);
		const rechecked: Array<string | undefined> = [];
		const registries: AtomRegistry.AtomRegistry[] = [];
		const clients: ReturnType<typeof connect>[] = [];
		const view = yield* screen.open(
			<App
				connected={(registry, client) => {
					registries.push(registry);
					clients.push(client);
				}}
				rechecked={() => {
					rechecked.push(host.state.session);
				}}
				session={() => host.state.session}
				signIn={() => {
					host.state.session = "alice";
				}}
				url={host.url}
			/>,
		);
		yield* noteGoesLive(host, view, screen.tell);
		return { clients, host, rechecked, registries, screen, view };
	},
	inspect: ({ host, view }) => ({ ...host.state, html: view.container.innerHTML }),
	name: "live session",
	stages: ["screen"],
	verbs: ({ clients, host, rechecked, registries, screen, view }, story) => {
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
			denyRead: () =>
				Effect.sync(() => {
					story.tell("the server stops letting alice read the note");
					host.state.allowed = false;
				}),
			reads: () => Effect.sync(() => host.state.reads),
			rechecks: () => Effect.sync(() => rechecked.map((session) => session ?? "signed out")),
			registries: () => Effect.sync(() => registries.map(registryState)),
			rename: (title: string) =>
				screen.act(`the server renames the note to ${title} and the open note answers the change hint`, () =>
					Effect.runPromise(
						Effect.gen(function* () {
							const answered = yield* Effect.forkChild(nextAnswer());
							yield* Effect.promise(() => host.rename(title));
							yield* Fiber.join(answered);
						}).pipe(Effect.timeout("3 seconds"), Effect.orDie),
					),
				),
			revokeSession: () => revoke(host, rechecked, screen, view),
			shown: () => Effect.sync(() => view.container.textContent),
			signIn: () =>
				screen.act("alice signs in again", () => clickButton(view.container, "Sign in")).pipe(Effect.andThen(noteGoesLive(host, view, screen.tell))),
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
	clock: "live",
	*create() {
		const host = yield* Effect.acquireRelease(Effect.promise(openHost), (value) => Effect.promise(value.close));
		window.location.href = host.url;
		const screen = new Screen(() => undefined);
		const view = yield* screen.open();
		const engine: ScopedEngine = {
			credential: "bearer",
			current: undefined,
			host,
			screen,
			shell: shell(host.url, view, false),
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
				engine.shell = shell(engine.host.url, engine.view, true);
				yield* Effect.addFinalizer(() => sessionCookie());
			}
			const verbs = scopedVerbs(engine);
			for (const user of users) {
				yield* verbs.signIn(user);
			}
		},
	);
}
