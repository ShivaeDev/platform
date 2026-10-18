import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { DiagnosticsPoller } from "./DiagnosticsPoller.tsx";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";
export function pollingScreen() {
	return screenStory.trait("screen", "native diagnostics and Fleet reads start paused", function* (engine) {
		let diagnosticsReads = 0;
		let fleetReads = 0;
		const diagnostics = Atom.make(() => {
			diagnosticsReads += 1;
			return diagnosticsReads;
		});
		const fleet = Atom.make(() => {
			fleetReads += 1;
			return fleetReads;
		});
		const paused = Atom.make(true);
		engine.updatesPaused = paused;
		const view = yield* Effect.promise(() =>
			renderBoard({}, (_, registry) => <DiagnosticsPoller client={{ registry, updates: { paused } }} diagnostics={diagnostics} fleet={fleet} />),
		);
		trackScreen(engine, view, (line) => engine.tell?.(line));
	});
}
