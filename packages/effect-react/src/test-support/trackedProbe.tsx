import * as Atom from "effect/reactivity/Atom";
import { Activity, act } from "react";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { Rendered } from "#client/testing.ts";
import { TrackedProbe } from "./sessionProbes.ts";
export function trackedProbe(view: Rendered) {
	const built: number[] = [];
	const finalized: number[] = [];
	const rendered: number[] = [];
	const held = Atom.keepAlive(
		Atom.make((get) => {
			built.push(1);
			get.addFinalizer(() => finalized.push(1));
			return 1;
		}),
	);
	function show(mode: "visible" | "hidden", round: number) {
		return act(async () => {
			await view.render(
				<Activity mode={mode}>
					<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session="s1">
						{() => <TrackedProbe held={held} rendered={rendered} round={round} />}
					</SessionBoundary>
				</Activity>,
			);
			await Promise.resolve();
		});
	}

	return { built, finalized, rendered, show };
}
