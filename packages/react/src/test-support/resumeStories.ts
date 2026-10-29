import { useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import { createElement } from "react";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { resumeSignal } from "#resumeSignal.ts";
import { ResumeLiveScreen } from "./ResumeLiveScreen.tsx";
import { resumeLiveClient } from "./resumeLiveClient.ts";
import { counted, syntheticNative, syntheticWindow } from "./resumeSources.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	browser: ReturnType<typeof syntheticWindow>;
	fresh: ReturnType<typeof counted>;
	live?: ReturnType<typeof resumeLiveClient>;
	native: ReturnType<typeof syntheticNative>;
	root?: Rendered;
	stale: ReturnType<typeof counted>;
}
export const resumes = storyKit(
	screenKit(
		"resume screen",
		(): State => ({ browser: syntheticWindow(), fresh: counted(), native: syntheticNative(), stale: counted() }),
		(state, screen) => ({
			active: () => state.live?.active(),
			browserEvent: (type: "online" | "visibilitychange", visibility = "visible") =>
				screen.act(`browser ${type} while ${visibility}`, () => state.browser.fire(type, visibility)),
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
			subscriptionCount: () => state.live?.subscriptionCount(),
			text: () => state.root?.container.textContent,
			visibilityEvent: () => screen.act("the page becomes visible", () => window.dispatchEvent(new Event("visibilitychange"))),
			windowEvent: () => screen.act("the browser reconnects", () => window.dispatchEvent(new Event("online"))),
		}),
	),
);
function Values({ atoms }: { readonly atoms: readonly Atom.Atom<unknown>[] }) {
	return createElement("output", null, ...atoms.map((atom, index) => createElement(Value, { atom, key: index })));
}
function Value({ atom }: { readonly atom: Atom.Atom<unknown> }) {
	return createElement("span", null, String(useAtomValue(atom)));
}
export function resumeScreen(mode: "browser-native" | "swr" | "window") {
	return resumes.trait("screen", `a ${mode} resume probe`, function* ({ screen, state }) {
		let options: Parameters<typeof resumeSignal>[0] = { native: state.native.source, window: state.browser.window };
		if (mode === "window") {
			options = { window };
		}
		if (mode === "swr") {
			options = { native: state.native.source };
		}
		const signal = resumeSignal(options);
		let atoms: readonly Atom.Atom<unknown>[] = [Atom.makeRefreshOnSignal(signal)(state.fresh.atom)];
		if (mode === "window") {
			atoms = [signal];
		}
		if (mode === "swr") {
			atoms = [
				Atom.swr(state.fresh.atom, { focusSignal: signal, revalidateOnFocus: true, staleTime: "1 hour" }),
				Atom.swr(state.stale.atom, { focusSignal: signal, revalidateOnFocus: true, revalidateOnMount: false, staleTime: "0 millis" }),
			];
		}
		state.root = yield* screen.open(createElement(Values, { atoms }));
	});
}

export function liveResumeScreen(source: "native" | "browser") {
	return resumes.trait("screen", `automatic live queries with ${source} resume`, function* ({ screen, state }) {
		const client = resumeLiveClient(source === "native" ? state.native.source : undefined);
		state.live = client;
		state.root = yield* screen.open(createElement(ResumeLiveScreen, { client }));
	});
}
