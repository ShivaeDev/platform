import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Cause, Effect, Layer, Option } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { deployUpdate } from "#client/deployUpdate.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { App, startHost } from "./host.ts";
import { View } from "./View.tsx";

function activate(state: { readonly failActivation: boolean; readonly activations: string[] }) {
	if (state.failActivation) {
		return Effect.fail("Staged update failed");
	}
	return Effect.sync(() => {
		state.activations.push("staged update");
	});
}

export const deployStory = storyKit({
	*create() {
		const host = yield* Effect.promise(() => startHost("build-a"));
		const registry = AtomRegistry.make();
		const state: {
			host: Awaited<ReturnType<typeof startHost>>;
			update?: ReturnType<typeof deployUpdate<string>>;
			view?: Rendered;
			failActivation: boolean;
			backgroundActivation: boolean;
			releaseWrite: () => void;
			activations: string[];
			reloads: string[];
		} = { activations: [], backgroundActivation: true, failActivation: false, host, releaseWrite: () => undefined, reloads: [] };
		yield* Effect.addFinalizer(() =>
			Effect.promise(async () => {
				registry.dispose();
				await state.host.close();
			}),
		);
		const sockets: string[] = [];
		const webSocketConstructor = Layer.effect(
			Socket.WebSocketConstructor,
			Effect.map(Socket.WebSocketConstructor, (make) => (url, options) => {
				sockets.push(url);
				return make(url, options);
			}),
		).pipe(Layer.provide(layerWebSocketConstructor));
		const screen = new Screen(() => undefined);
		return { registry, screen, sockets, state, webSocketConstructor };
	},
	inspect: ({ screen, sockets, state }) => ({ ...screen.inspect(), activations: state.activations, reloads: state.reloads, sockets }),
	name: "loaded tab across deploys",
	stages: [],
	verbs: ({ registry, screen, sockets, state, webSocketConstructor }, story) => {
		screen.tell = story.tell;
		function container() {
			if (state.view === undefined) {
				throw new Error("Open the tab first");
			}
			return state.view.container;
		}
		function settle() {
			return settleScreen(
				container(),
				() =>
					container().querySelector("p")?.textContent !== "Application ready"
					|| (state.host.buildVersion !== undefined && container().querySelector("output")?.textContent === "Waiting for host"),
				story.tell,
			);
		}
		return {
			activation: () =>
				Effect.sync(() => {
					if (state.update === undefined) {
						throw new Error("Open the tab first");
					}
					const result = registry.get(state.update.activation);
					return result._tag === "Failure" ? Option.getOrUndefined(Cause.findErrorOption(result.cause)) : "no activation failure";
				}),
			activations: () => Effect.sync(() => state.activations),
			closeSheet: () => screen.driver(container()).click({ name: "Close sheet", role: "button" }),
			failActivation: () =>
				Effect.sync(() => {
					state.failActivation = true;
				}),
			finishWrite: () => screen.act("the pending write completes", () => state.releaseWrite()),
			hide: () =>
				screen.act("the tab becomes hidden", () => {
					Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
					document.dispatchEvent(new Event("visibilitychange"));
				}),
			holdWrite: () =>
				screen.act("a write is pending", () => {
					if (state.update === undefined) {
						throw new Error("Open the tab first");
					}
					state.releaseWrite = Effect.runSync(state.update.block.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));
				}),
			openSheet: () => screen.driver(container()).click({ name: "Open sheet", role: "button" }),
			*openTab(loadedVersion: string) {
				window.location.href = state.host.url;
				Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
				state.update = deployUpdate({
					...(state.backgroundActivation ? { activate: Effect.suspend(() => activate(state)) } : {}),
					loadedVersion,
					reload: () => {
						state.reloads.push("reload requested");
					},
					url: state.host.url,
					webSocketConstructor,
				});
				const { api } = makeClient(App, { url: state.host.url, webSocketConstructor });
				state.view = yield* screen.open(<View read={api.read.query()} registry={registry} update={state.update} />);
				yield* settle();
			},
			reload: () => screen.driver(container()).click({ name: "Reload application", role: "button" }),
			reloadOnly: () =>
				Effect.sync(() => {
					state.backgroundActivation = false;
				}),
			reloads: () => Effect.sync(() => state.reloads),
			*restart(version: string | undefined) {
				story.tell(`restart the host with build ${version ?? "unconfigured"} on the same port`);
				const port = state.host.port;
				yield* screen.act("the old host stops", state.host.close);
				state.host = yield* Effect.promise(() => startHost(version, port));
			},
			show: () =>
				screen.act("the tab becomes visible", () => {
					Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
					document.dispatchEvent(new Event("visibilitychange"));
				}),
			shown: () => Effect.sync(() => container().textContent),
			sockets: () => Effect.sync(() => sockets.map((url) => new URL(url).pathname)),
			status: () =>
				Effect.sync(() => ({
					available: container().querySelector("output")?.getAttribute("data-available"),
					blocked: container().querySelector("output")?.getAttribute("data-blocked"),
					version: container().querySelector("output")?.textContent,
				})),
			waitForVersion: (version: string) => settleScreen(container(), () => container().querySelector("output")?.textContent !== version, story.tell),
		};
	},
});
