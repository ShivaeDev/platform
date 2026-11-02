import { Deferred, Effect } from "effect";
import { act } from "react";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { hostedHealthScreen } from "./hostedHealthScreen.tsx";
import { screenSettles } from "./screenSettle.ts";
import { screenStory } from "./screenStory.ts";
import { screenFiles, screenRoute } from "./screenWorkspaceTraits.ts";
import { searchScreen } from "./searchScreen.tsx";
import { sessionScreen } from "./sessionScreen.ts";
import { livePageShown, untilScreen } from "./shellSessionVerbs.ts";

export function searchOpened(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	return screenStory.traits(
		searchScreen(files, options),
		screenStory.trait("screen", "Search finishes opening", function* (engine) {
			yield* screenSettles(engine);
		}),
	);
}

export function holdableRead(url: string) {
	return screenStory.trait("workspace", `the document read for ${url} can be held`, function* (engine) {
		const gate = yield* Deferred.make<void>();
		yield* Deferred.succeed(gate, undefined);
		const read = { gate, started: false, startedSignal: yield* Deferred.make<void>(), url };
		engine.heldRead = read;
		yield* Effect.addFinalizer(() =>
			Effect.promise(() => act(() => Promise.resolve().then(() => Effect.runSync(Deferred.succeed(read.gate, undefined))))),
		);
	});
}

export function hostedHealthSettled(...args: Parameters<typeof hostedHealthScreen>) {
	return screenStory.traits(
		hostedHealthScreen(...args),
		screenStory.trait("screen", "the host's page finishes its reads", function* (engine) {
			yield* screenSettles(engine);
		}),
	);
}

export function sessionOpenedAt(files: Readonly<Record<string, string>>, route: string) {
	return [screenFiles(files, { home: "home.md" }), screenRoute(route), sessionOpened("response")];
}

export function sessionOpened(kind: Parameters<typeof sessionScreen>[0]) {
	return screenStory.traits(
		sessionScreen(kind),
		screenStory.trait("screen", "the live session shows its page and goes Live", function* (engine) {
			yield* untilScreen((line) => engine.tell?.(line), livePageShown());
		}),
	);
}
