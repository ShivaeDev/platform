import { act } from "react";
import type { render } from "@shivaedev/effect-react/client/testing.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { captureReading, restoreReading } from "#client/react/readingState.ts";
import { ageActions } from "./ageActions.tsx";
import { appearanceActions } from "./appearanceActions.ts";
import { chrome } from "./chrome.ts";
import { diagramActions } from "./diagramActions.ts";
import { motionActions } from "./motionActions.ts";
import { renderBoard } from "./react.tsx";
import { readingActions } from "./readingActions.ts";
import { renderRouter } from "./renderRouter.tsx";
import { screenActions } from "./screenActions.ts";
import { availabilityActions } from "./screenAvailability.tsx";
import { screenData } from "./screenData.ts";
import { createScreen, screenView, trackScreen } from "./screenEngine.ts";
import { screenClient, screenContent } from "./screenFeatures.tsx";
import { screenInteractions } from "./screenInteractions.ts";
import { screenObservations } from "./screenObservations.ts";
import { screenOptions, screenReadVerbs } from "./screenReads.ts";
import { sessionActions } from "./sessionActions.ts";
import { sessionTransportActions } from "./sessionTransportActions.ts";

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
			chrome: async (files = engine.files, path = engine.path) => {
				story.tell(`the reader opens ${path}`);
				const view = await chrome(files, path);
				engine.router = view.router;
				return trackScreen(engine, view, story.tell);
			},
			restoreReading: (...args: Parameters<typeof restoreReading>) => {
				story.tell("the reader restores the remembered document reading");
				restoreReading(...args);
			},
			...screenActions(story.tell),
			...readingActions(story.tell),
			...ageActions(engine, story.tell),
			...appearanceActions(story.tell),
			...screenObservations(engine, story.tell),
			...screenData(engine, story.tell),
			...diagramActions(engine, story.tell),
			...screenInteractions(engine, story.tell),
			...sessionActions(engine, story.tell),
			...sessionTransportActions(engine, story.tell),
			...motionActions(engine, story.tell),
			...availabilityActions(engine, story.tell),
			...screenReadVerbs(engine, story.tell),
			boardView() {
				if (!engine.boardScreen) {
					throw new Error("The story has no Board screen");
				}
				return engine.boardScreen;
			},
			documentView() {
				if (!engine.documentView) {
					throw new Error("The story has no document screen");
				}
				return engine.documentView;
			},
			navigate: async (to: string) => {
				story.tell(`the reader navigates to ${to}`);
				if (!engine.router) {
					throw new Error("The screen has no router");
				}
				await act(() => engine.router?.navigate({ to }));
			},
			read: () => {
				story.tell("the reader reads the screen");
				return screenView(engine);
			},
			render: async (...args: Parameters<typeof render>) => {
				story.tell("the reader opens the component screen");
				return trackScreen(
					engine,
					await renderBoard(
						engine.files,
						(api) => {
							screenClient(engine, api);
							return screenContent(engine, args[0]);
						},
						screenOptions(engine, engine.options),
					),
					story.tell,
				);
			},
			renderRouter: async (files = engine.files, path = engine.path, options = engine.options, prepare?: Parameters<typeof renderRouter>[3]) => {
				story.tell(`the reader opens ${path} with ${Object.keys(files).join(", ")}`);
				const view = await renderRouter(
					files,
					path,
					screenOptions(engine, options),
					(api, registry) => {
						screenClient(engine, api);
						prepare?.(api, registry);
					},
					(node) => screenContent(engine, node),
				);
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
