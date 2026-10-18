import type { Rendered } from "#client/testing.ts";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface ProbeState<TProbe> {
	build: (root: Rendered) => TProbe;
	probe?: TProbe;
	root?: Rendered;
}
export function probeOptions<TProbe extends object, TVerbs extends object>(
	name: string,
	build: (root: Rendered) => TProbe,
	verbs: (probe: () => TProbe, screen: Screen) => TVerbs,
) {
	return screenKit(
		name,
		(): ProbeState<TProbe> => ({ build }),
		(state, screen) => {
			function probe() {
				if (!(state.probe && state.root)) {
					throw new Error("No session probe");
				}
				return { ...state.probe, root: state.root };
			}
			return {
				close: () => screen.act("unmount the session probe", () => probe().root.unmount()),
				probe,
				...verbs(probe, screen),
			};
		},
	);
}
export function* mountProbe<TProbe>({ state, screen }: { state: ProbeState<TProbe>; screen: Screen }, build = state.build) {
	state.root = yield* screen.open();
	state.probe = build(state.root);
}
