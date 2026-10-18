import { Deferred, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expect } from "vitest";
import { loadQuery } from "#loadQuery.ts";
import { screenKit } from "./screenKit.ts";

interface Request {
	readonly controller: AbortController;
	readonly promise: Promise<string>;
	settled: boolean;
}
interface State {
	atom: Atom.Atom<AsyncResult.AsyncResult<string>>;
	gate: Deferred.Deferred<string>;
	interrupted: boolean;
	registry?: AtomRegistry.AtomRegistry;
	requests: Map<string, Request>;
}
function current(state: State) {
	if (!state.registry) {
		throw new Error("No loader owner");
	}
	return state.registry;
}
export const loaders = screenKit(
	"native loader",
	(): State => ({ atom: Atom.make(AsyncResult.initial()), gate: Effect.runSync(Deferred.make<string>()), interrupted: false, requests: new Map() }),
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
			aborted: (name: string) => Effect.promise(() => expect(request(name).promise).rejects.toMatchObject({ name: "AbortError" })),
			begin: (name: string) => {
				screen.tell(`start loader ${name}`);
				const controller = new AbortController();
				const pending: Request = { controller, promise: loadQuery(current(state), state.atom, { abortController: controller }), settled: false };
				pending.promise.then(
					() => {
						pending.settled = true;
					},
					() => {
						pending.settled = true;
					},
				);
				state.requests.set(name, pending);
			},
			broken: (name: string) => Effect.promise(() => expect(request(name).promise).rejects.toThrow("broken client")),
			complete: (value: string) => screen.act(`the query responds ${value}`, () => Effect.runSync(Deferred.succeed(state.gate, value))),
			interrupted: () => state.interrupted,
			refresh: () => {
				screen.tell("refresh the mounted native query");
				state.gate = Effect.runSync(Deferred.make<string>());
				current(state).refresh(state.atom);
			},
			settled: (name: string) => request(name).settled,
			value: (name: string) => Effect.promise(() => request(name).promise),
			wait: () => Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 10))),
		};
	},
);
export function loaderOwner(mode: "mounted" | "shared" | "defect" | "interrupt") {
	return loaders.trait("screen", `a scoped registry with a ${mode} loader`, function* ({ state }) {
		state.registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(registry) => Effect.sync(() => registry.dispose()),
		);
		const work = loaderWork(state, mode);
		state.atom = Atom.make(work).pipe(Atom.setIdleTTL(0));
		if (mode === "mounted") {
			yield* Effect.acquireRelease(
				Effect.sync(() => current(state).mount(state.atom)),
				(release) => Effect.sync(release),
			);
		}
	});
}

function loaderWork(state: State, mode: "mounted" | "shared" | "defect" | "interrupt") {
	if (mode === "defect") {
		return Effect.die(new Error("broken client"));
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
	return Effect.suspend(() => Deferred.await(state.gate));
}
