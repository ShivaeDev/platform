import { Effect, Ref } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { LiveConnection } from "#automaticLive.ts";
import { resumeSignal } from "#resume.ts";
import { automaticResumeClient } from "./automaticResumeClient.ts";
import { collectGarbage } from "./collectGarbage.ts";
import { localEngine } from "./localEngine.ts";
import { syntheticNative, syntheticWindow } from "./resumeSources.ts";

interface Configuration {
	automatic?: "native" | "browser";
}

export const resumeStory = storyKit({
	clock: "live",
	*create() {
		const engine = yield* localEngine;
		const browser = syntheticWindow();
		const native = syntheticNative();
		const configuration: Configuration = {};
		return { ...engine, browser, configuration, includeBrowser: true, native };
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
		const mode = engine.configuration.automatic;
		const client = mode === undefined ? undefined : automaticResumeClient(engine.server, mode === "native" ? native.source : undefined);
		const api = client?.api ?? engine.api;
		const signal = resumeSignal({ native: native.source, ...(engine.includeBrowser ? { window: browser.window } : {}) });
		return {
			active: () => client?.active(),
			collectGarbage: () => {
				story.tell("the runtime collects unreferenced atoms");
				return collectGarbage();
			},
			connect: () => registry.mount(api[LiveConnection].connection),
			disconnect: () => {
				if (client === undefined) {
					throw new Error("Missing automatic subscription");
				}
				return client.disconnect();
			},
			dispose: () => registry.dispose(),
			externalRename: (id: number, title: string) => engine.server.implementation["notes.rename"]({ id, title }),
			fire: (type: "online" | "visibilitychange", visibility = "visible") => {
				story.tell(`the browser fires ${type} while ${visibility}`);
				browser.fire(type, visibility);
			},
			listeners: () => [browser.listeners.size, native.listeners.size],
			loaded: (id: number) => AtomRegistry.getResult(registry, api.get.query({ id })),
			prepare: (id: number) => {
				story.tell(`prepare note ${id}'s query without reading it`);
				api.get.query({ id });
			},
			reads: (id: number) => Effect.runSync(Ref.get(engine.server.reads)).filter((label) => label === `get:${id}`).length,
			resume: () => {
				story.tell("the native application resumes");
				native.resume();
			},
			status: () => registry.get(api[LiveConnection].status),
			subscriptionCount: () => client?.connections(),
			title: (id: number) => AsyncResult.getOrElse(registry.get(api.get.query({ id })), () => undefined)?.title,
			watch: (id: number, freshness?: "fresh" | "stale") => {
				story.tell(`watch note ${id}${freshness === undefined ? "" : ` with ${freshness} data`}`);
				const query = api.get.query({ id });
				if (mode !== undefined) {
					return registry.mount(query);
				}
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
			windowEvent: (type: "online" | "visibilitychange") => window.dispatchEvent(new Event(type)),
		};
	},
});

export function automaticResume(source: "native" | "browser") {
	return resumeStory.trait("sources", `automatic subscriptions with ${source} resume`, (engine) => {
		engine.configuration.automatic = source;
	});
}

export function nativeOnly() {
	return resumeStory.trait("sources", "only the native resume source is supplied", (engine) => {
		engine.includeBrowser = false;
	});
}
