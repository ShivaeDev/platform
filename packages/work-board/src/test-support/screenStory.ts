import { act } from "react";
import type { render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { captureReading, restoreReading } from "#client/react/readingState.ts";
import { answersScreenVerbs } from "./answersScreenVerbs.ts";
import { appearanceActions } from "./appearanceActions.ts";
import { chrome } from "./chrome.ts";
import { diagramActions } from "./diagramActions.ts";
import { distinctVerbs } from "./distinctVerbs.ts";
import { itemContextVerbs } from "./itemContextVerbs.ts";
import { liveScreenVerbs } from "./liveScreenVerbs.ts";
import { motionActions } from "./motionActions.ts";
import { outlineActions } from "./outlineActions.ts";
import { pagesScreenVerbs } from "./pagesScreenVerbs.ts";
import { renderBoard } from "./react.tsx";
import { readingActions } from "./readingActions.ts";
import { readingPageVerbs } from "./readingPageVerbs.ts";
import { readingScreenVerbs } from "./readingScreenVerbs.ts";
import { renderRouter } from "./renderRouter.tsx";
import { responsesScreenVerbs } from "./responsesScreenVerbs.ts";
import { screenActions } from "./screenActions.ts";
import { availabilityActions } from "./screenAvailability.tsx";
import { screenData } from "./screenData.ts";
import { createScreen, screenView, trackScreen } from "./screenEngine.ts";
import { screenClient, screenContent } from "./screenFeatures.tsx";
import { screenInteractions } from "./screenInteractions.ts";
import { loaderObservations } from "./screenLoader.ts";
import { screenObservations } from "./screenObservations.ts";
import { screenOptions, screenReadVerbs } from "./screenReads.ts";
import { screenRoles } from "./screenRoles.ts";
import { readoutVerbs, settlingOnly, settlingVerbs } from "./screenSettle.ts";
import { servingScreenVerbs } from "./servingScreenVerbs.ts";
import { sessionActions } from "./sessionActions.ts";
import { sessionTransportActions } from "./sessionTransportActions.ts";
import { shellScreenVerbs } from "./shellScreenVerbs.ts";
import { timeActions } from "./timeActions.tsx";
import { workspaceScreenVerbs } from "./workspaceScreenVerbs.ts";

export const screenStory = storyKit({
	clock: "live",
	create: createScreen,
	inspect: (engine) =>
		engine.view?.container.isConnected || engine.container?.isConnected ? screenView(engine) : (engine.lastView ?? screenView(engine)),
	name: "board screen",
	stages: ["workspace", "screen"],
	verbs: (engine, story) => {
		engine.tell = story.tell;
		const own = {
			boardView() {
				if (!engine.boardScreen) {
					throw new Error("The story has no Board screen");
				}
				return engine.boardScreen;
			},
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
			restoreReading: (...args: Parameters<typeof restoreReading>) => {
				story.tell("the reader restores the remembered document reading");
				restoreReading(...args);
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
		const interactions = screenInteractions(engine, story.tell);
		return distinctVerbs(
			settlingVerbs(engine, own, ["boardView", "captureReading", "documentView", "read", "routed", "screen"]),
			settlingVerbs(engine, screenActions(story.tell), ["control"]),
			settlingVerbs(engine, readingActions(story.tell)),
			settlingVerbs(engine, timeActions(engine, story.tell), ["advanceClock"]),
			settlingVerbs(engine, appearanceActions(story.tell)),
			readoutVerbs(engine, screenObservations(engine, story.tell)),
			screenRoles(engine, story.tell),
			itemContextVerbs(engine, story.tell),
			loaderObservations(engine, story.tell),
			settlingVerbs(engine, screenData(engine, story.tell), ["deleteFile", "editFile", "failDocument", "recoverDocument", "startNavigation"]),
			settlingVerbs(engine, diagramActions(engine, story.tell), ["diagramPalette", "drawings"]),
			settlingVerbs(engine, interactions, ["readDraftRecoveries", "readDraftRecovery", "readInnerScrollers", "stored"]),
			settlingVerbs(engine, sessionActions(engine, story.tell), ["readSessionFiles"]),
			settlingVerbs(engine, sessionTransportActions(engine, story.tell), ["pauseCommand"]),
			settlingOnly(engine, motionActions(engine, story.tell), ["queueReading"]),
			settlingVerbs(engine, outlineActions(engine, story.tell)),
			settlingVerbs(engine, availabilityActions(engine, story.tell), [
				"failWorkspace",
				"holdRefreshAfterAnswer",
				"holdWorkspace",
				"readIndexReads",
				"recoverWorkspace",
			]),
			settlingVerbs(engine, screenReadVerbs(engine, story.tell), ["pauseRead", "readDocumentReads"]),
			answersScreenVerbs(engine, story.tell),
			pagesScreenVerbs(engine, story.tell),
			readingScreenVerbs(engine, story.tell),
			readingPageVerbs(engine, story.tell),
			shellScreenVerbs(engine, story.tell),
			responsesScreenVerbs(engine, story.tell),
			servingScreenVerbs(engine, story.tell),
			liveScreenVerbs(engine, story.tell),
			workspaceScreenVerbs(engine, story.tell),
		);
	},
});
