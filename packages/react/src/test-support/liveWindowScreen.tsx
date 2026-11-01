import { type Duration, Effect, Layer, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { live } from "@shivaedev/contract/live.ts";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { SessionRegistry } from "./SessionRegistry.tsx";
import { screenKit } from "./screenKit.ts";

function idleBinding() {
	return live(Atom.runtime(Layer.empty), { coalesceWindow: "75 millis", resyncKeys: [], stream: Stream.never });
}

interface State {
	readonly binding: ReturnType<typeof idleBinding>;
	registry?: AtomRegistry.AtomRegistry;
	root?: Rendered;
}

function remember(state: State, registry: AtomRegistry.AtomRegistry) {
	state.registry = registry;
}

function session(state: State, window: Duration.Input | undefined) {
	return (
		<SessionBoundary
			connect={() => ({ [LiveConnection]: state.binding })}
			identify={(id) => id}
			liveCoalesceWindow={window}
			recheck={() => undefined}
			session="ada"
		>
			{() => <SessionRegistry onRegistry={(found) => remember(state, found)} />}
		</SessionBoundary>
	);
}

export const liveWindowScreen = storyKit(
	screenKit(
		"session live coalescing window",
		(): State => ({ binding: idleBinding() }),
		(state, screen) => ({
			bindingWindow: () =>
				Effect.sync(() => {
					if (state.registry === undefined) {
						throw new Error("The session never rendered");
					}
					return state.registry.get(state.binding.coalesceWindow);
				}),
			changeWindow: (window: Duration.Input | undefined) =>
				Effect.promise(async () => {
					screen.tell(`change the session window to ${window}`);
					if (state.root === undefined) {
						throw new Error("The session is not open");
					}
					await state.root.render(session(state, window));
				}),
			open: (window: Duration.Input) =>
				Effect.gen(function* () {
					state.root = yield* screen.open(session(state, window));
				}),
		}),
	),
);
