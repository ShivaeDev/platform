import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readBoard } from "#board.ts";
import { type PaneView, paneView } from "#pane.tsx";
import { bandLine } from "#summary.ts";
import { installPaneJsx, paneElements, reactPane } from "#test/paneElements.ts";
import { reply, success } from "#test/rpcReplies.ts";
import type { WorkboardBoard } from "#types/index.d.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export const createPane = Effect.fnUntraced(function* () {
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
	const view: PaneView = {
		achievedOpen: false,
		board: { kind: "loading" },
		columns: 80,
		onOpen: () => undefined,
		onRefresh: () => undefined,
		onToggleAchieved: () => {
			view.achievedOpen = !view.achievedOpen;
			draw();
		},
		surface: "desktop",
		updated: "just now",
	};
	function draw() {
		root.render(reactPane(paneView(paneElements, view)));
	}
	return {
		container,
		render: async (board: WorkboardBoard, surface: "desktop" | "terminal" = "desktop", columns = 80) => {
			Object.assign(view, { board, columns, surface });
			await act(draw);
		},
		summary: "",
	};
});

export const pluginPane = storyKit({
	create: createPane,
	name: "Claude plugin pane",
	stages: ["board"],
	verbs: (engine, story) => ({
		band: () => engine.summary,
		click: (label: string) =>
			Effect.promise(async () => {
				story.tell(`click ${label}`);
				const button = [...engine.container.querySelectorAll("button")].find((node) => node.textContent?.includes(label));
				if (!button) {
					throw new Error(`The pane has no ${label} button`);
				}
				await act(() => button.click());
			}),
		screen: () => {
			story.tell("read the rendered pane");
			return engine.container;
		},
		section: (title: string) => {
			story.tell(`read the ${title} section`);
			const heading = [...engine.container.querySelectorAll("span")].find((node) => node.textContent === title);
			const section = heading?.parentElement?.parentElement;
			if (!section) {
				throw new Error(`The pane has no ${title} section`);
			}
			return section;
		},
		show: (items: readonly unknown[], goals: readonly unknown[], surface: "desktop" | "terminal" = "desktop", columns = 80) =>
			Effect.promise(async () => {
				story.tell("render the Board's answers in the plugin pane");
				const board = readBoard(
					reply(success("1", { you: [] }), success("2", { fleet: { items, state: "ready" }, goals: { goals } })),
					"/repo",
					1_800_000_000_000,
				);
				engine.summary = board.kind === "ready" ? bandLine(board) : "";
				await engine.render(board, surface, columns);
			}),
	}),
});
