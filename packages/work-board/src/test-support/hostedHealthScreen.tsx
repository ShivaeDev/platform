import { Effect, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { HostedHealth, type LiveClient } from "./HostedHealth.tsx";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenClient } from "./screenFeatures.tsx";
import { screenStory } from "./screenStory.ts";
export function hostedHealthScreen(connection: "connecting" | "live" = "live") {
	return screenStory.trait("screen", `a host supplies its displayed location without a document element while ${connection}`, function* (engine) {
		engine.documentFailed = true;
		const paused = Atom.make(false);
		const status = Atom.make<Atom.Type<LiveClient["updates"]["status"]>>({
			connection,
			failure: Option.none(),
			needsResync: false,
			pending: 0,
		});
		const view = yield* Effect.promise(() =>
			renderBoard(
				{ "broken.md": "# Recovered" },
				(api, registry) => {
					screenClient(engine, api);
					return <HostedHealth client={{ api, registry, updates: { paused, status } }} />;
				},
				{ beforeRead: () => (engine.documentFailed ? Effect.die("Read unavailable") : Effect.void), home: undefined },
			),
		);
		trackScreen(engine, view, (line) => engine.tell?.(line));
	});
}
