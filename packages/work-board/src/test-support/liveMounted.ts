import { Effect, Option, Result, type Scope, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { browserClient } from "#browserClient.ts";
import { present } from "./liveState.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

type Client = ReturnType<typeof browserClient>;

interface MountedView {
	readonly kept: () => string;
	readonly mount: () => Effect.Effect<unknown, never, Scope.Scope>;
	readonly update: () => Effect.Effect<unknown>;
}

function goalSummary(goals: { readonly closedGoals: readonly GoalRow[]; readonly goals: readonly GoalRow[] }, id: string) {
	const open = goals.goals.find((goal) => goal.id === id);
	if (open) {
		return { counts: open.counts, group: "open" };
	}
	const closed = goals.closedGoals.find((goal) => goal.id === id);
	return closed ? { counts: closed.counts, group: "closed" } : "missing";
}

interface GoalRow {
	readonly counts: unknown;
	readonly id: string;
}

function view<A, E>(client: Client, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, summary: (value: A) => unknown): MountedView {
	let first: A | undefined;
	let latest: A | undefined;
	return {
		kept: () => {
			const current = client.registry.get(atom);
			return AsyncResult.isSuccess(current) && current.value === first ? "the first read" : "a new read";
		},
		mount: () =>
			Effect.gen(function* () {
				yield* Effect.acquireRelease(
					Effect.sync(() => client.registry.mount(atom)),
					(release) => Effect.sync(release),
				);
				const value = yield* Effect.promise(() => client.read(atom));
				first = value;
				latest = value;
				yield* AtomRegistry.toStream(client.registry, client.updates.status).pipe(
					Stream.takeUntil((status) => status.connection === "live"),
					Stream.runDrain,
				);
				return summary(value);
			}),
		update: () => {
			const before = JSON.stringify(latest);
			return AtomRegistry.toStream(client.registry, atom).pipe(
				Stream.filterMap((result) =>
					AsyncResult.isSuccess(result) && !result.waiting && JSON.stringify(result.value) !== before
						? Result.succeed(result.value)
						: Result.failVoid,
				),
				Stream.runHead,
				Effect.flatMap((read) => Option.match(read, { onNone: () => Effect.die(new Error("The mounted view stopped")), onSome: Effect.succeed })),
				Effect.map((value) => {
					latest = value;
					return summary(value);
				}),
			);
		},
	};
}

export type ViewName =
	| "getting started"
	| "goals"
	| "navigation"
	| "the home board"
	| "the Inbox"
	| "the note"
	| "the note's board read"
	| "the watcher"
	| "the work board"
	| "the work table";

function views(client: Client): Record<ViewName, () => MountedView> {
	return {
		"getting started": () => view(client, client.api.start.query(), (start) => (start.empty ? "an empty project" : "a project with documents")),
		goals: () => view(client, client.api.goals.query(), (goals) => goalSummary(goals, "project.example")),
		navigation: () => view(client, client.api.navigation.query({ current: "note.md" }), (navigation) => `${navigation.counts.library} library files`),
		"the home board": () => view(client, client.api.board.query({ url: "/home.md" }), (board) => board.document.source),
		"the Inbox": () => view(client, client.api.inbox.query(), (inbox) => inbox.you[0]?.title ?? "empty"),
		"the note": () => view(client, client.api.document.query({ url: "/note.md" }), (document) => document.source),
		"the note's board read": () => view(client, client.api.board.query({ url: "/note.md" }), (board) => board.document.source),
		"the watcher": () => view(client, client.api.watcher.query(), (watcher) => (watcher.watching ? "watching" : "not watching")),
		"the work board": () => view(client, client.api.work.query({ url: "/_board/work?view=board" }), (work) => work.items[0]?.title ?? "empty"),
		"the work table": () => view(client, client.api.work.query({ url: "/_board/work?view=table" }), (work) => work.items[0]?.title ?? "empty"),
	};
}

const mounted = new WeakMap<BoardEngine, Map<ViewName, MountedView>>();

const checkedConnection = new WeakMap<BoardEngine, string>();

export function mountedVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function viewed(name: ViewName) {
		return present(mounted.get(engine)?.get(name), `${name} is not mounted; call mounts first`);
	}
	return {
		connectionBecomes: (state: "live" | "reconnecting") => {
			tell(`the reader's client waits until its connection is ${state}`);
			const { client } = served(engine);
			return AtomRegistry.toStream(client.registry, client.updates.status).pipe(
				Stream.takeUntil((status) => status.connection === state),
				Stream.runDrain,
			);
		},
		connectionState: () => {
			tell("the reader checks its client's connection");
			const { client } = served(engine);
			return Effect.sync(() => {
				const connection = client.registry.get(client.updates.status).connection;
				checkedConnection.set(engine, connection);
				return connection;
			});
		},
		mountedKept: (name: ViewName) =>
			Effect.sync(() => {
				tell(`the reader checks whether ${name} still holds its first read`);
				return viewed(name).kept();
			}),
		mountedUpdate: (name: ViewName) => {
			tell(`the reader waits for ${name} to show a new read`);
			return viewed(name).update();
		},
		mounts: (name: ViewName) => {
			tell(`the reader's client mounts ${name} and waits for its live connection`);
			const created = views(served(engine).client)[name]();
			let byName = mounted.get(engine);
			if (!byName) {
				byName = new Map();
				mounted.set(engine, byName);
			}
			byName.set(name, created);
			return created.mount();
		},
		nextConnectionState: () => {
			tell("the reader waits for its client's connection to leave the state it last checked");
			const { client } = served(engine);
			const before = present(checkedConnection.get(engine), "The reader has not checked its connection; call connectionState first");
			return AtomRegistry.toStream(client.registry, client.updates.status).pipe(
				Stream.map((status) => status.connection),
				Stream.filter((connection) => connection !== before),
				Stream.runHead,
				Effect.map(Option.getOrElse(() => before)),
			);
		},
	};
}
