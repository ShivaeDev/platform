import { useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import { createElement } from "react";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { resumeSignal } from "#resumeSignal.ts";
import { counted, syntheticNative, syntheticWindow } from "./resumeSources.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	browser: ReturnType<typeof syntheticWindow>;
	fresh: ReturnType<typeof counted>;
	native: ReturnType<typeof syntheticNative>;
	root?: Rendered;
	stale: ReturnType<typeof counted>;
}
export const resumes = storyKit(
	screenKit(
		"resume screen",
		(): State => ({ browser: syntheticWindow(), fresh: counted(), native: syntheticNative(), stale: counted() }),
		(state, screen) => ({
			browserEvent: (type: "online" | "visibilitychange", visibility = "visible") =>
				screen.act(`browser ${type} while ${visibility}`, () => state.browser.fire(type, visibility)),
			close: () =>
				screen.act("unmount the resume screen", () => {
					if (!state.root) {
						throw new Error("Missing resume screen root");
					}
					return state.root.unmount();
				}),
			nativeEvent: () => screen.act("native resume", () => state.native.resume()),
			resume: () => state,
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
