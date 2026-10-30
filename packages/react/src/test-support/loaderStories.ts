import { Deferred, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { loadQuery } from "#loadQuery.ts";
import { describeValue } from "./outcomeWords.ts";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

type Outcome = "pending" | `loaded ${string}` | "aborted" | `failed: ${string}`;

interface Request {
	readonly controller: AbortController;
	outcome: Outcome;
	settled: Promise<void>;
}

interface State {
	atom: Atom.Atom<AsyncResult.AsyncResult<string>>;
	gate: Deferred.Deferred<string>;
	readonly interrupted: Deferred.Deferred<void>;
	registry?: AtomRegistry.AtomRegistry;
	readonly requests: Map<string, Request>;
	started: Deferred.Deferred<void>;
}

function owner(state: State) {
	if (!state.registry) {
		throw new Error("No loader owner");
	}
	return state.registry;
}

function request(state: State, name: string) {
	const found = state.requests.get(name);
	if (!found) {
		throw new Error(`No loader ${name}`);
	}
	return found;
}

function begin(state: State, screen: Screen, name: string) {
	screen.tell(`start loader ${name}`);
	const controller = new AbortController();
	const started: Request = { controller, outcome: "pending", settled: Promise.resolve() };
	const settled = loadQuery(owner(state), state.atom, { abortController: controller }).then(
		(value) => {
			started.outcome = `loaded ${value}`;
		},
		(error: unknown) => {
			started.outcome = error instanceof Error && error.name === "AbortError" ? "aborted" : `failed: ${describeValue(error)}`;
		},
	);
	started.settled = settled;
	state.requests.set(name, started);
}

function answer(state: State, screen: Screen, value: string) {
	return screen.act(`the query answers ${value}`, () => Effect.runSync(Deferred.succeed(state.gate, value)));
}

function settles(state: State, screen: Screen, name: string) {
	return screen.act(`loader ${name} settles`, () => request(state, name).settled).pipe(Effect.map(() => request(state, name).outcome));
}

export const loaders = storyKit(
	screenKit(
		"native loader",
		(): State => ({
			atom: Atom.make(AsyncResult.initial()),
			gate: Deferred.makeUnsafe<string>(),
			interrupted: Deferred.makeUnsafe<void>(),
			requests: new Map(),
			started: Deferred.makeUnsafe<void>(),
		}),
		(state, screen) => ({
			abort: (name: string) => screen.act(`abort loader ${name}`, () => request(state, name).controller.abort()),
			answer: (value: string) => answer(state, screen, value),
			begin: (name: string) =>
				Effect.sync(() => {
					begin(state, screen, name);
				}),
			outcome: (name: string) => Effect.sync(() => request(state, name).outcome),
			queryWork: () =>
				Deferred.await(state.interrupted).pipe(
					Effect.as("interrupted" as const),
					Effect.timeoutOrElse({ duration: "3 seconds", orElse: () => Effect.succeed("still running" as const) }),
				),
			settles: (name: string) => settles(state, screen, name),
		}),
	),
);

type Work = "answered by the story" | "dies with broken client" | "never answers";

function loaderWork(state: State, work: Work) {
	if (work === "dies with broken client") {
		return Effect.die(new Error("broken client"));
	}
	if (work === "never answers") {
		return Effect.never.pipe(Effect.onInterrupt(() => Deferred.succeed(state.interrupted, undefined)));
	}
	return Effect.suspend(() => Deferred.succeed(state.started, undefined).pipe(Effect.andThen(Deferred.await(state.gate))));
}

function owned(work: Work, mounted: boolean) {
	return function* ({ state }: { readonly state: State }) {
		state.registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(registry) => Effect.sync(() => registry.dispose()),
		);
		state.atom = Atom.make(loaderWork(state, work)).pipe(Atom.setIdleTTL(0));
		if (mounted) {
			yield* Effect.acquireRelease(
				Effect.sync(() => owner(state).mount(state.atom)),
				(release) => Effect.sync(release),
			);
		}
	};
}

export function queryWhoseWork(work: Work) {
	return loaders.trait("screen", `an unmounted query whose work ${work}`, owned(work, false));
}

function* answeredFirst(engine: { readonly screen: Screen; readonly state: State }, value: string) {
	yield* owned("answered by the story", true)(engine);
	begin(engine.state, engine.screen, "first");
	yield* answer(engine.state, engine.screen, value);
	yield* settles(engine.state, engine.screen, "first");
}

export function loaderStartedDuringRefresh() {
	return loaders.trait(
		"screen",
		"a mounted query answered first, was refreshed, and loader second started while the refresh waits",
		function* (engine) {
			yield* answeredFirst(engine, "first");
			const { screen, state } = engine;
			yield* screen.act("refresh the mounted query and wait for it to ask the server again", () => {
				state.gate = Deferred.makeUnsafe<string>();
				state.started = Deferred.makeUnsafe<void>();
				owner(state).refresh(state.atom);
				return Effect.runPromise(Deferred.await(state.started));
			});
			begin(state, screen, "second");
		},
	);
}

export function twoLoadersWaiting() {
	return loaders.trait("screen", "loaders canceled and remaining both wait on one unanswered query", function* (engine) {
		yield* owned("answered by the story", false)(engine);
		begin(engine.state, engine.screen, "canceled");
		begin(engine.state, engine.screen, "remaining");
	});
}
