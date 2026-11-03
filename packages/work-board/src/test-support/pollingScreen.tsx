import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { clockReading } from "#client/react/adapters/now.ts";
import { DiagnosticsPoller } from "./DiagnosticsPoller.tsx";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
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
		const view = yield* Effect.promise(() => renderBoard({}, () => null, { runtime: engine.clock.runtime }));
		yield* AtomRegistry.getResult(view.registry, view.forms.runtime.atom(clockReading));
		yield* Effect.promise(() =>
			view.render(<DiagnosticsPoller client={{ registry: view.registry, updates: { paused } }} diagnostics={diagnostics} fleet={fleet} />),
		);
		trackScreen(engine, view, (line) => engine.tell?.(line));
		yield* screenSettles(engine);
	});
}
