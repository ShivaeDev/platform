import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { deployUpdate } from "#client/deployUpdate.ts";
import { startHost } from "#test/deploy-update/host.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { changeClient } from "./client.ts";
import { View } from "./View.tsx";

export const undoableChangeStory = storyKit({
	clock: "live",
	*create() {
		const host = yield* Effect.acquireRelease(
			Effect.promise(() => startHost("build-b")),
			(startedHost) => Effect.promise(startedHost.close),
		);
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(ownedRegistry) => Effect.sync(() => ownedRegistry.dispose()),
		);
		const screen = new Screen(() => undefined);
		const activations: string[] = [];
		const update = deployUpdate({
			activate: Effect.sync(() => {
				activations.push("build-b");
			}),
			loadedVersion: "build-a",
			reload: () => undefined,
			url: host.url,
			webSocketConstructor: layerWebSocketConstructorWS,
		});
		const state: { view?: Rendered } = {};
		return { activations, props: { client: changeClient(), registry, update }, screen, state };
	},
	inspect: ({ screen }) => screen.inspect(),
	name: "undoable versioned changes",
	stages: [],
	verbs: (engine, story) => {
		const { props, screen } = engine;
		const { client } = props;
		screen.tell = story.tell;
		function container() {
			if (engine.state.view === undefined) {
				throw new Error("Open the screen first");
			}
			return engine.state.view.container;
		}
		function shown(selector: string) {
			return Effect.sync(() => container().querySelector(selector)?.textContent ?? "");
		}
		function settle() {
			return settleScreen(container(), () => container().querySelector('[data-loading="true"]') !== null, story.tell);
		}
		function click(name: string) {
			return screen.driver(container()).click({ name, role: "button" });
		}
		function start(id: string, removed: boolean, name: string) {
			return screen.act(name, async () => {
				await Effect.runPromise(click(name));
				await Effect.runPromise(Deferred.await(client.hold(id, removed).arrived));
			});
		}
		function complete(id: string, removed: boolean) {
			return screen
				.act(`the server answers ${id}'s ${removed ? "removal" : "Undo"}`, async () => {
					const { gate, finished } = client.hold(id, removed);
					Deferred.doneUnsafe(gate, Effect.void);
					await Effect.runPromise(Deferred.await(finished));
					client.forget(id, removed);
				})
				.pipe(Effect.andThen(settle()));
		}
		return {
			activations: () => Effect.sync(() => [...engine.activations]),
			completeRemove: (id: string) => complete(id, true),
			completeUndo: (id: string) => complete(id, false),
			*edit(id: string) {
				Deferred.doneUnsafe(client.hold(id, true).gate, Effect.void);
				yield* start(id, true, `Edit ${id}`);
				yield* settle();
				client.forget(id, true);
			},
			hide: () =>
				screen.act("hide the tab", () => {
					Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
					document.dispatchEvent(new Event("visibilitychange"));
				}),
			notice: () => shown("[data-notice]"),
			*open() {
				Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
				engine.state.view = yield* screen.open(<View {...props} />);
				yield* settleScreen(container(), () => container().querySelector("[data-version]")?.textContent !== "build-b", story.tell);
				yield* settle();
			},
			remove: (id: string) => start(id, true, `Remove ${id}`),
			row: (id: string) => shown(`[data-row="${id}"]`),
			status: () => shown("[data-status]"),
			undo: (id: string) => start(id, false, "Undo").pipe(Effect.andThen(settle())),
			undoFailure: () => shown("[data-undo]"),
		};
	},
});
