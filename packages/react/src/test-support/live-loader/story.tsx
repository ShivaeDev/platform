import { Effect } from "effect";
import { act } from "react";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { HAND_OVER_WINDOW } from "#adapters/queryHandoff.ts";
import { idleRegistry } from "#test/idleRegistry.ts";
import { liveLoaderHost } from "#test/live-loader/host.ts";
import { loaderRoute } from "#test/loaderRoute.tsx";
import type { Engine } from "#test/loaderScreenState.ts";
import { respond, routeVerbs } from "#test/loaderVerbs.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

type LiveHost = Effect.Success<ReturnType<typeof liveLoaderHost>>;

export const liveLoader = storyKit({
	clock: "test",
	*create() {
		const host = yield* liveLoaderHost();
		const engine: Engine<LiveHost> = {
			activity: host.activity,
			host,
			loaded: Promise.withResolvers<void>(),
			mount: Promise.withResolvers<void>(),
			mountGate: { wait: () => Promise.resolve() },
			renders: [],
		};
		return engine;
	},
	inspect: (engine) => ({ calls: engine.host.calls, screen: engine.view?.container.textContent, subscriptions: engine.host.subscriptions() }),
	name: "live loader route",
	stages: ["screen"],
	verbs: (engine, story) => ({
		...routeVerbs(engine, story),
		handOverWindowPasses: () => {
			story.tell(`the loader's ${HAND_OVER_WINDOW} hand-over window passes`);
			return untilTimer(HAND_OVER_WINDOW).pipe(Effect.andThen(passes(HAND_OVER_WINDOW, engine.host.closed)));
		},
		queryRuns: () => Effect.sync(() => [...engine.host.calls]),
		subscriptions: () => Effect.sync(() => engine.host.subscriptions()),
	}),
});

export function liveNoteShown(title: string) {
	return liveLoader.trait("screen", `the live note route's loader read ${title} and the route mounted at once`, function* (engine) {
		yield* loaderRoute(engine);
		yield* respond(engine, title, () => undefined);
	});
}

export function liveNoteMountedAfterIdleWindow(title: string) {
	return liveLoader.trait(
		"screen",
		`the live note route's loader read ${title} and the route mounted only after the session registry's idle window passed`,
		function* (engine) {
			engine.mountGate.wait = idleRegistry;
			yield* loaderRoute(engine);
			yield* respond(engine, title, () => undefined);
		},
	);
}

export function liveNoteLoadedButNotMounted(title: string) {
	return liveLoader.trait("screen", `the live note route's loader read ${title} and the route has not mounted yet`, function* (engine) {
		engine.mountGate.wait = () => engine.mount.promise;
		yield* loaderRoute(engine);
		yield* Effect.promise(async () => {
			await act(async () => engine.host.respond(title));
			await act(() => engine.loaded.promise);
		});
	});
}
