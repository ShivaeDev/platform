import { Deferred, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { loadQuery } from "#loadQuery.ts";
import { screenKit } from "./screenKit.ts";

interface Request {
	readonly controller: AbortController;
	readonly promise: Promise<string>;
}
interface State {
	atom: Atom.Atom<AsyncResult.AsyncResult<string>>;
	gate: Deferred.Deferred<string>;
	interrupted: boolean;
	registry?: AtomRegistry.AtomRegistry;
	requests: Map<string, Request>;
	started: Deferred.Deferred<void>;
}
function current(state: State) {
	if (!state.registry) {
		throw new Error("No loader owner");
	}
	return state.registry;
}
export const loaders = storyKit(
	screenKit(
		"native loader",
		(): State => ({
			atom: Atom.make(AsyncResult.initial()),
			gate: Effect.runSync(Deferred.make<string>()),
			interrupted: false,
			requests: new Map(),
			started: Effect.runSync(Deferred.make<void>()),
		}),
		(state, screen) => {
			function request(name: string) {
				const found = state.requests.get(name);
				if (!found) {
					throw new Error(`No loader ${name}`);
				}
				return found;
			}
			return {
				abort: (name: string) => {
					screen.tell(`abort loader ${name}`);
					request(name).controller.abort();
				},
				awaitRefresh: () => screen.act("the refreshed query reaches its response gate", () => Effect.runPromise(Deferred.await(state.started))),
				begin: (name: string) => {
					screen.tell(`start loader ${name}`);
					const controller = new AbortController();
					const pending: Request = { controller, promise: loadQuery(current(state), state.atom, { abortController: controller }) };
					state.requests.set(name, pending);
				},
				complete: (value: string) => screen.act(`the query responds ${value}`, () => Effect.runSync(Deferred.succeed(state.gate, value))),
				interrupted: () => state.interrupted,
				pending: request,
				refresh: () => {
					screen.tell("refresh the mounted native query");
					state.gate = Effect.runSync(Deferred.make<string>());
					state.started = Effect.runSync(Deferred.make<void>());
					current(state).refresh(state.atom);
				},
			};
		},
	),
);
export function loaderOwner(mode: "mounted" | "shared" | "defect" | "interrupt", defect?: unknown) {
	return loaders.trait("screen", `a scoped registry with a ${mode} loader`, function* ({ state }) {
		state.registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(registry) => Effect.sync(() => registry.dispose()),
		);
		const work = loaderWork(state, mode, defect);
		state.atom = Atom.make(work).pipe(Atom.setIdleTTL(0));
		if (mode === "mounted") {
			yield* Effect.acquireRelease(
				Effect.sync(() => current(state).mount(state.atom)),
				(release) => Effect.sync(release),
			);
		}
	});
}

function loaderWork(state: State, mode: "mounted" | "shared" | "defect" | "interrupt", defect: unknown) {
	if (mode === "defect") {
		return Effect.die(defect);
	}
	if (mode === "interrupt") {
		return Effect.never.pipe(
			Effect.onInterrupt(() =>
				Effect.sync(() => {
					state.interrupted = true;
				}),
			),
		);
	}
	return Effect.suspend(() => Deferred.succeed(state.started, undefined).pipe(Effect.andThen(Deferred.await(state.gate))));
}
