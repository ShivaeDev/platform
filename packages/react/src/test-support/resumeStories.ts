import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ResumeLiveScreen } from "./ResumeLiveScreen.tsx";
import { resumeLiveClient } from "./resumeLiveClient.ts";
import { screenKit } from "./screenKit.ts";
import { syntheticNative } from "./syntheticNative.ts";

interface State {
	live?: ReturnType<typeof resumeLiveClient>;
	native: ReturnType<typeof syntheticNative>;
	root?: Rendered;
}
export const resumes = storyKit(
	screenKit(
		"resume screen",
		(): State => ({ native: syntheticNative() }),
		(state, screen) => ({
			active: () => state.live?.active(),
			close: () =>
				screen.act("unmount the resume screen", () => {
					if (!state.root) {
						throw new Error("Missing resume screen root");
					}
					return state.root.unmount();
				}),
			disconnect: () =>
				screen.act("interrupt the live stream", () => {
					if (!state.live) {
						throw new Error("Missing live client");
					}
					return state.live.disconnect();
				}),
			externalRename: (id: number, title: string) =>
				screen.act("another client renames the note", () => {
					if (!state.live) {
						throw new Error("Missing live client");
					}
					state.live.rename(id, title);
				}),
			nativeEvent: () => screen.act("native resume", () => state.native.resume()),
			resume: () => state,
			subscriptionStates: () => state.live?.subscriptionStates(),
			text: () => state.root?.container.textContent,
			visibilityEvent: () => screen.act("the page becomes visible", () => window.dispatchEvent(new Event("visibilitychange"))),
			windowEvent: () => screen.act("the browser reconnects", () => window.dispatchEvent(new Event("online"))),
		}),
	),
);
export function liveResumeScreen(source: "native" | "browser") {
	return resumes.trait("screen", `automatic live queries with ${source} resume`, function* ({ screen, state }) {
		const client = resumeLiveClient(source === "native" ? state.native.source : undefined);
		state.live = client;
		state.root = yield* screen.open(createElement(ResumeLiveScreen, { client }));
	});
}
