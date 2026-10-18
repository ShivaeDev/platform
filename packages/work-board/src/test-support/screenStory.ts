import { Effect } from "effect";
import { act } from "react";
import { render } from "@shivaedev/effect-react/testing.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { captureReading, restoreReading } from "#client/react/readingState.ts";
import { chrome } from "./chrome.ts";
import { mountDocument } from "./documentRendering.ts";
import { mountSession } from "./mountSession.ts";
import { renderBoard } from "./react.tsx";
import { renderRouter } from "./renderRouter.tsx";
import { screenActions } from "./screenActions.ts";
import { createScreen, screenView, trackScreen } from "./screenEngine.ts";
import { goalsContent, screenClient, screenContent, systemContent } from "./screenFeatures.tsx";
import { screenOptions, screenReadVerbs } from "./screenReads.ts";

export const screenStory = storyKit({
	clock: "live",
	create: createScreen,
	inspect: (engine) =>
		engine.view?.container.isConnected || engine.container?.isConnected ? screenView(engine) : (engine.lastView ?? screenView(engine)),
	name: "board screen",
	stages: ["workspace", "screen"],
	verbs: (engine, story) => {
		engine.tell = story.tell;
		return {
			captureReading: () => {
				story.tell("the reader remembers the document selection and scroll");
				return captureReading();
			},
			chrome: async (...args: Parameters<typeof chrome>) => {
				story.tell(`the reader opens ${args[1] ?? "/notes/plan.md"}`);
				const view = await chrome(...args);
				engine.router = view.router;
				return trackScreen(engine, view, story.tell);
			},
			mountDocument: async (...args: Parameters<typeof mountDocument>) => {
				story.tell(`the reader opens the document ${args[0].file}`);
				const view = await mountDocument(...args);
				engine.container = view.container;
				engine.cleanups.push(async () => {
					engine.lastView = screenView(engine);
					await view.unmount();
				});
				return {
					...view,
					render: async (...next: Parameters<typeof view.render>) => {
						story.tell("the document receives refreshed source");
						await view.render(...next);
					},
				};
			},
			mountSession: (kind: "response" | "handoff") => {
				story.tell(`the reader opens a ${kind} form in a live session`);
				return mountSession(engine, kind);
			},
			renderGoals: async (files?: Parameters<typeof goalsContent>[0]) => {
				story.tell("the reader opens the goals screen");
				const content = await Effect.runPromise(Effect.gen(() => goalsContent(files)));
				return trackScreen(engine, await render(content), story.tell);
			},
			restoreReading: (...args: Parameters<typeof restoreReading>) => {
				story.tell("the reader restores the remembered document reading");
				restoreReading(...args);
			},
			system: async (fleet: Parameters<typeof systemContent>[0]) => {
				story.tell("the reader opens System with Fleet's current items");
				return trackScreen(engine, await render(systemContent(fleet)), story.tell);
			},
			...screenActions(story.tell),
			...screenReadVerbs(engine, story.tell),
			boardView() {
				if (!engine.boardScreen) {
					throw new Error("The story has no Board screen");
				}
				return engine.boardScreen;
			},
			navigate: async (to: string) => {
				story.tell(`the reader navigates to ${to}`);
				if (!engine.router) {
					throw new Error("The screen has no router");
				}
				await act(async () => engine.router?.navigate({ to }));
			},
			read: () => {
				story.tell("the reader reads the screen");
				return screenView(engine);
			},
			render: async (...args: Parameters<typeof render>) => {
				story.tell("the reader opens the component screen");
				return trackScreen(engine, await render(screenContent(engine, args[0])), story.tell);
			},
			renderBoard: async (...args: Parameters<typeof renderBoard>) => {
				story.tell(`the reader opens a Board screen with ${Object.keys(args[0]).join(", ")}`);
				return trackScreen(
					engine,
					await renderBoard(
						args[0],
						(api, registry) => {
							screenClient(engine, api);
							return screenContent(engine, args[1](api, registry));
						},
						args[2],
					),
					story.tell,
				);
			},
			renderRouter: async (files = engine.files, path = engine.path, options = engine.options, prepare?: Parameters<typeof renderRouter>[3]) => {
				story.tell(`the reader opens ${path} with ${Object.keys(files).join(", ")}`);
				const view = await renderRouter(files, path, screenOptions(engine, options), (api, registry) => {
					screenClient(engine, api);
					prepare?.(api, registry);
				});
				engine.router = view.router;
				return trackScreen(engine, view, story.tell);
			},
			routed() {
				if (!engine.routed) {
					throw new Error("The story has no routed screen");
				}
				return engine.routed;
			},
			screen() {
				if (!engine.view) {
					throw new Error("The story has no mounted screen");
				}
				return engine.view;
			},
		};
	},
});
