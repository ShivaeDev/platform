import { Effect } from "effect";
import { act } from "react";
import { atomRemoved, idleRegistry } from "./idleRegistry.ts";
import { loaderRoute } from "./loaderRoute.tsx";
import { loaderScreen } from "./loaderScreen.tsx";
import { sessionRegistry, settle } from "./loaderScreenState.ts";
import { findLink, refresh, respond } from "./loaderVerbs.ts";

export function noteShown(title: string) {
	return loaderScreen.trait("screen", `the note route loaded and shows ${title}`, function* (engine) {
		yield* loaderRoute(engine);
		yield* respond(engine, title, () => undefined);
	});
}

export function noteLoadWaiting() {
	return loaderScreen.trait("screen", "the note's loader waits for its server response", function* (engine) {
		yield* loaderRoute(engine);
		yield* engine.host.started;
	});
}

export function noteMountedAfterIdleWindow(title: string) {
	return loaderScreen.trait(
		"screen",
		`the note's loader read ${title} and the route mounted only after the session registry's idle window passed`,
		function* (engine) {
			engine.mountGate.wait = idleRegistry;
			yield* loaderRoute(engine);
			yield* respond(engine, title, () => undefined);
		},
	);
}

export function noteLoadedButNotMounted(title: string) {
	return loaderScreen.trait("screen", `the note's loader read ${title} and its route has not mounted yet`, function* (engine) {
		engine.mountGate.wait = () => engine.mount.promise;
		yield* loaderRoute(engine);
		yield* Effect.promise(async () => {
			await act(async () => engine.host.respond(title));
			await act(() => engine.loaded.promise);
		});
	});
}

export function noteLeftAfterShowing(title: string) {
	return loaderScreen.trait(
		"screen",
		`the note route showed ${title}, then the Home link left it and its query wrapper was swept`,
		function* (engine) {
			yield* loaderRoute(engine);
			yield* respond(engine, title, () => undefined);
			const home = yield* findLink(engine, "Home");
			const registry = sessionRegistry(engine);
			const swept = atomRemoved(registry, engine.host.atom);
			yield* Effect.promise(async () => {
				await act(async () => home.click());
				await act(() => swept);
			});
			yield* settle(engine, () => undefined);
		},
	);
}

export function refreshHeld(title: string) {
	return loaderScreen.trait("screen", `the note route shows ${title} and the server holds the answer to its Refresh`, function* (engine) {
		yield* loaderRoute(engine);
		yield* respond(engine, title, () => undefined);
		yield* refresh(engine, () => undefined);
	});
}
