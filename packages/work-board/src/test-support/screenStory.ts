import { act } from "react";
import type { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { captureReading, restoreReading } from "#client/react/readingState.ts";
import { answerActions } from "#test/answerActions.ts";
import { answersScreenVerbs } from "#test/answersScreenVerbs.ts";
import { appearanceActions } from "#test/appearanceActions.ts";
import { chrome } from "#test/chrome.ts";
import { chunkResponseVerbs } from "#test/chunkResponseVerbs.ts";
import { distinctVerbs } from "#test/distinctVerbs.ts";
import { driveWatchTimers } from "#test/driveWatchTimers.ts";
import { itemContextVerbs } from "#test/itemContextVerbs.ts";
import { liveScreenVerbs } from "#test/liveScreenVerbs.ts";
import { motionActions } from "#test/motionActions.ts";
import { outlineActions } from "#test/outlineActions.ts";
import { pagesScreenVerbs } from "#test/pagesScreenVerbs.ts";
import { renderBoard } from "#test/react.tsx";
import { readingActions } from "#test/readingActions.ts";
import { readingPageVerbs } from "#test/readingPageVerbs.ts";
import { readingScreenVerbs } from "#test/readingScreenVerbs.ts";
import { renderRouter } from "#test/renderRouter.tsx";
import { responsesScreenVerbs } from "#test/responsesScreenVerbs.ts";
import { availabilityActions } from "#test/screenAvailability.tsx";
import { screenData } from "#test/screenData.ts";
import { createScreen, screenView, trackScreen } from "#test/screenEngine.ts";
import { screenClient, screenContent } from "#test/screenFeatures.tsx";
import { screenInteractions } from "#test/screenInteractions.ts";
import { loaderObservations } from "#test/screenLoader.ts";
import { screenObservations } from "#test/screenObservations.ts";
import { screenOptions, screenReadVerbs } from "#test/screenReads.ts";
import { screenRoles } from "#test/screenRoles.ts";
import { readoutVerbs, settlingOnly, settlingVerbs } from "#test/screenSettle.ts";
import { servingScreenVerbs } from "#test/servingScreenVerbs.ts";
import { sessionActions } from "#test/sessionActions.ts";
import { sessionTransportActions } from "#test/sessionTransportActions.ts";
import { shellScreenVerbs } from "#test/shellScreenVerbs.ts";
import { storyClock } from "#test/storyTime.ts";
import { timeActions } from "#test/timeActions.tsx";
import { workspaceScreenVerbs } from "#test/workspaceScreenVerbs.ts";

export const screenStory = storyKit({
	around: driveWatchTimers,
	clock: storyClock,
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
			settlingVerbs(engine, answerActions(story.tell)),
			settlingVerbs(engine, readingActions(story.tell)),
			settlingVerbs(engine, timeActions(engine, story.tell)),
			settlingVerbs(engine, appearanceActions(story.tell)),
			readoutVerbs(engine, screenObservations(engine, story.tell)),
			screenRoles(engine, story.tell),
			itemContextVerbs(engine, story.tell),
			loaderObservations(engine, story.tell),
			settlingVerbs(engine, screenData(engine, story.tell), ["deleteFile", "editFile", "failDocument", "recoverDocument", "startNavigation"]),
			settlingVerbs(engine, interactions, ["readDraftRecoveries", "readDraftRecovery", "readInnerScrollers", "stored"]),
			settlingVerbs(engine, sessionActions(engine, story.tell), ["readSessionFiles"]),
			settlingVerbs(engine, sessionTransportActions(engine, story.tell), ["pauseCommand"]),
			settlingOnly(engine, motionActions(engine, story.tell), ["queueReading"]),
			settlingVerbs(engine, outlineActions(engine, story.tell)),
			settlingVerbs(engine, availabilityActions(engine, story.tell), [
				"failWorkspace",
				"holdRefreshAfterAnswer",
				"holdWorkspace",
				"readWorkspaceRequests",
				"recoverWorkspace",
			]),
			settlingVerbs(engine, screenReadVerbs(engine, story.tell), ["pauseRead", "readPageRequests"]),
			answersScreenVerbs(engine, story.tell),
			pagesScreenVerbs(engine, story.tell),
			readingScreenVerbs(engine, story.tell),
			chunkResponseVerbs(engine, story.tell),
			readingPageVerbs(engine, story.tell),
			shellScreenVerbs(engine, story.tell),
			responsesScreenVerbs(engine, story.tell),
			servingScreenVerbs(engine, story.tell),
			liveScreenVerbs(engine, story.tell),
			workspaceScreenVerbs(engine, story.tell),
		);
	},
});
