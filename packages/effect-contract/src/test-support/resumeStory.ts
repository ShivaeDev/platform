import { Effect, Ref } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resumeSignal } from "#resume.ts";
import { eventually } from "./eventually.ts";
import { localEngine } from "./localEngine.ts";
import { syntheticNative, syntheticWindow } from "./resumeSources.ts";

export const resumeStory = storyKit({
	clock: "live",
	*create() {
		const engine = yield* localEngine;
		const browser = syntheticWindow();
		const native = syntheticNative();
		return { ...engine, browser, includeBrowser: true, native };
	},
	inspect: ({ browser, native, server }) => ({
		browserListeners: browser.listeners.size,
		nativeListeners: native.listeners.size,
		reads: Effect.runSync(Ref.get(server.reads)),
	}),
	name: "notes resume",
	stages: ["sources"],
	verbs: (engine, story) => {
		const { browser, native, registry } = engine;
		const signal = resumeSignal({ native: native.source, ...(engine.includeBrowser ? { window: browser.window } : {}) });
		return {
			dispose: () => registry.dispose(),
			fire: (type: "online" | "visibilitychange", visibility = "visible") => {
				story.tell(`the browser fires ${type} while ${visibility}`);
				browser.fire(type, visibility);
			},
			listeners: () => [browser.listeners.size, native.listeners.size],
			loaded: (id: number) => eventually(() => expect(AsyncResult.isSuccess(registry.get(engine.api.get.query({ id })))).toBe(true)),
			reads: (id: number) => Effect.runSync(Ref.get(engine.server.reads)).filter((label) => label === `get:${id}`).length,
			resume: () => {
				story.tell("the native application resumes");
				native.resume();
			},
			watch: (id: number, freshness?: "fresh" | "stale") => {
				story.tell(`watch note ${id}${freshness === undefined ? "" : ` with ${freshness} data`}`);
				const query = engine.api.get.query({ id });
				if (freshness === undefined) {
					return registry.mount(Atom.makeRefreshOnSignal(signal)(query));
				}
				return registry.mount(
					Atom.swr(query, {
						focusSignal: signal,
						revalidateOnFocus: true,
						...(freshness === "fresh" ? { staleTime: "1 hour" } : { revalidateOnMount: false, staleTime: "0 millis" }),
					}),
				);
			},
		};
	},
});

export function nativeOnly() {
	return resumeStory.trait("sources", "only the native resume source is supplied", (engine) => {
		engine.includeBrowser = false;
	});
}
