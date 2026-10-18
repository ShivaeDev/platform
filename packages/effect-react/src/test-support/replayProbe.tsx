import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { act, StrictMode } from "react";
import { SessionBoundary } from "#session-boundary.ts";
import type { Rendered } from "#testing.ts";
import { type RegistryHolder, ReplayProbe } from "./sessionProbes.ts";
export function replayProbe(view: Rendered) {
	const count = Atom.make(Effect.succeed(41));
	const held: RegistryHolder = {};
	function show(session: string | undefined) {
		return act(async () => {
			await view.render(
				<StrictMode>
					<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session}>
						{() => <ReplayProbe count={count} held={held} />}
					</SessionBoundary>
				</StrictMode>,
			);
			await Promise.resolve();
		});
	}

	return { held, show };
}
