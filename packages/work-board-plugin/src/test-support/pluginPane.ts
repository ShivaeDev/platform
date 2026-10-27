import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readBoard } from "#board.ts";
import { paneView } from "#pane.tsx";
import { installPaneJsx, paneElements, reactPane } from "#test/paneElements.ts";
import { reply, success } from "#test/rpcReplies.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export const pluginPane = storyKit({
	*create() {
		installPaneJsx();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		yield* Effect.addFinalizer(() =>
			Effect.promise(async () => {
				await act(() => root.unmount());
				container.remove();
				Reflect.deleteProperty(globalThis, "h");
			}),
		);
		return { container, root };
	},
	name: "Claude plugin pane",
	stages: ["board"],
	verbs: ({ container, root }, story) => ({
		screen: () => {
			story.tell("read the rendered pane");
			return container;
		},
		show: (items: readonly unknown[], goals: readonly unknown[], surface: "desktop" | "terminal" = "desktop", columns = 80) =>
			Effect.promise(async () => {
				story.tell("render the Board's answers in the plugin pane");
				const board = readBoard(
					reply(success("1", { you: [] }), success("2", { items, state: "ready" }), success("3", { goals })),
					"/repo",
					1_800_000_000_000,
				);
				await act(() =>
					root.render(
						reactPane(paneView(paneElements, { board, columns, onOpen: () => undefined, onRefresh: () => undefined, surface, updated: "just now" })),
					),
				);
			}),
	}),
});
