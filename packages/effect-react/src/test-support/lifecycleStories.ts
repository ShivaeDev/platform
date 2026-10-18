import type { Rendered } from "#testing.ts";
import { activityProbe } from "./activityProbe.tsx";
import { activityRegistry } from "./activityRegistry.ts";
import { replayProbe } from "./replayProbe.tsx";
import { rotationProbe } from "./rotationProbe.tsx";
import { screenKit } from "./screenKit.ts";
import { trackedProbe } from "./trackedProbe.tsx";

function probeKit<TProbe extends object>(name: string, build: (root: Rendered) => TProbe) {
	interface State {
		probe?: TProbe;
		root?: Rendered;
	}
	const kit = screenKit(
		name,
		(): State => ({}),
		(state, screen) => ({
			close: () => screen.act("unmount the session probe", () => state.root?.unmount()),
			probe: () => {
				if (!(state.probe && state.root)) {
					throw new Error("No session probe");
				}
				return { ...state.probe, root: state.root };
			},
		}),
	);
	return {
		...kit,
		mounted: () =>
			kit.trait("screen", `a rendered ${name}`, function* ({ screen, state }) {
				state.root = yield* screen.open();
				state.probe = build(state.root);
			}),
	};
}
export const replay = probeKit("StrictMode session screen", replayProbe);
export function activity(hoisted: boolean) {
	return probeKit("Activity session screen", (root) => activityProbe(root, hoisted));
}
export const tracked = probeKit("hidden session screen", trackedProbe);
export const rotation = probeKit("rotating session screen", rotationProbe);
export const registryActivity = probeKit("Activity registry screen", activityRegistry);
