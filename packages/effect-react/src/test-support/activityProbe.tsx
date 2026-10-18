import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { Activity, act } from "react";
import { SessionBoundary } from "#session-boundary.ts";
import type { Rendered } from "#testing.ts";
import { DraftProbe } from "./sessionProbes.ts";
export function activityProbe(view: Rendered, hoisted: boolean) {
	const count = Atom.make(Effect.succeed(41));
	const registries: AtomRegistry.AtomRegistry[] = [];
	function boundary() {
		return (
			<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session="s1">
				{() => <DraftProbe count={count} registries={registries} />}
			</SessionBoundary>
		);
	}
	const kept = boundary();
	const errors: unknown[] = [];
	async function show(mode: "visible" | "hidden") {
		try {
			await act(async () => {
				await view.render(<Activity mode={mode}>{hoisted ? kept : boundary()}</Activity>);
				await Promise.resolve();
			});
		} catch (error) {
			errors.push(error);
		}
	}

	return { errors, registries, show };
}
