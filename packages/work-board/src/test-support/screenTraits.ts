import { Deferred, Effect } from "effect";
import { act } from "react";
import { eventually, render } from "@shivaedev/react/client/testing.ts";
import { ANSWER_SOURCE, answerDraft, answerFiles, answerPreview } from "./answerDraft.tsx";
import { mountDocument } from "./documentRendering.ts";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import { renderBoard } from "./react.tsx";
import { renderRouter } from "./renderRouter.tsx";
import { screenData } from "./screenData.ts";
import { screenView, trackScreen } from "./screenEngine.ts";
import { goalsContent, readingContent, screenClient, screenContent, systemContent } from "./screenFeatures.tsx";
import { screenOptions } from "./screenReads.ts";
import { screenStory } from "./screenStory.ts";
import { screenFiles, screenRoute } from "./screenWorkspaceTraits.ts";

export function openScreen() {
	return screenStory.trait("screen", "the reader opens the configured route", function* (engine) {
		const view = yield* Effect.promise(() =>
			renderRouter(
				engine.files,
				engine.path,
				screenOptions(engine, engine.options),
				(api) => screenClient(engine, api),
				(node) => screenContent(engine, node),
			),
		);
		engine.router = view.router;
		engine.routed = trackScreen(engine, view, (line) => engine.tell?.(line));
	});
}
export function routedScreen(files: Parameters<typeof renderRouter>[0], path: string, options?: BoardFixtureOptions) {
	return screenStory.traits(screenFiles(files, options), screenRoute(path), openScreen());
}
export function chromeScreen(files: Parameters<typeof renderRouter>[0], path = "/notes/plan.md", options?: BoardFixtureOptions) {
	return screenStory.traits(
		routedScreen(files, path, options),
		screenStory.trait("screen", `the shell finishes opening ${path}`, function* (engine) {
			yield* eventually(() => {
				if (engine.view?.container.querySelector("#doc")?.getAttribute("data-route") !== path) {
					throw new Error(`The shell is still opening ${path}`);
				}
			});
		}),
	);
}
export function componentScreen(...args: Parameters<typeof render>) {
	return screenStory.trait("screen", "the reader opens the feature's component", function* (engine) {
		trackScreen(
			engine,
			yield* Effect.promise(() =>
				renderBoard(
					engine.files,
					(api) => {
						screenClient(engine, api);
						return screenContent(engine, args[0]);
					},
					screenOptions(engine, engine.options),
				),
			),
			(line) => engine.tell?.(line),
		);
	});
}
export function boardScreen(...args: Parameters<typeof renderBoard>) {
	return screenStory.trait("screen", `the reader opens a Board screen with ${Object.keys(args[0]).join(", ")}`, function* (engine) {
		engine.files = { ...args[0] };
		engine.options = args[2];
		engine.boardScreen = trackScreen(
			engine,
			yield* Effect.promise(() =>
				renderBoard(
					engine.files,
					(api, registry) => {
						screenClient(engine, api);
						return screenContent(engine, args[1](api, registry));
					},
					args[2],
				),
			),
			(line) => engine.tell?.(line),
		);
	});
}

export function answerScreen(preview = answerPreview, update = 0, prompts: Parameters<typeof answerDraft>[2] = [], source = ANSWER_SOURCE) {
	return screenStory.traits(
		screenFiles({ ...answerFiles, "question.md": source }, { home: "question.md", writable: true }),
		componentScreen(answerDraft(preview, update, prompts)),
		screenStory.trait("screen", "the Board response services are ready", function* (engine) {
			yield* Effect.promise(() =>
				act(async () => {
					await screenData(engine, (line) => engine.tell?.(line)).readInbox();
				}),
			);
		}),
	);
}
export function readingScreen(kind: string) {
	return componentScreen(readingContent(kind));
}

export function pausedDocument(url: string) {
	return screenStory.trait("workspace", `the document read for ${url} waits`, function* (engine) {
		const gate = yield* Deferred.make<void>();
		engine.heldRead = { gate, started: false, url };
		yield* Effect.addFinalizer(() => Deferred.succeed(gate, undefined));
	});
}

export function goalsScreen(files?: Parameters<typeof goalsContent>[0]) {
	return screenStory.trait("screen", "the reader opens the goals", function* (engine) {
		const content = yield* goalsContent(files);
		trackScreen(engine, yield* Effect.promise(() => render(content)), (line) => engine.tell?.(line));
	});
}
export function systemScreen(fleet: Parameters<typeof systemContent>[0]) {
	return componentScreen(systemContent(fleet));
}
export function documentScreen(...args: Parameters<typeof mountDocument>) {
	return screenStory.trait("screen", "the reader opens a document", function* (engine) {
		const view = yield* Effect.promise(() => mountDocument(...args));
		engine.documentView = view;
		engine.container = view.container;
		engine.cleanups.push(async () => {
			if (engine.container === view.container && view.container.isConnected) {
				engine.lastView = screenView(engine);
			}
			await view.unmount();
		});
	});
}
