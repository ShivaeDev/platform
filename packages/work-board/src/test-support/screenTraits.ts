import { Deferred, Effect } from "effect";
import { act } from "react";
import { render } from "@shivaedev/test-story/client/react.ts";
import { ANSWER_SOURCE, answerDraft, answerFiles, answerPreview } from "./answerDraft.tsx";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { mountDocument } from "./documentRendering.ts";
import { renderBoard } from "./react.tsx";
import { renderRouter } from "./renderRouter.tsx";
import { screenData } from "./screenData.ts";
import { screenView, trackScreen } from "./screenEngine.ts";
import { goalsContent, readingContent, screenClient, screenContent, systemContent } from "./screenFeatures.tsx";
import { observeLoader } from "./screenLoader.ts";
import { screenOptions } from "./screenReads.ts";
import { screenSettles } from "./screenSettle.ts";
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
		yield* screenSettles(engine);
	});
}
export function routedScreen(files: Parameters<typeof renderRouter>[0], path: string, options?: BoardFixtureOptions) {
	return screenStory.traits(screenFiles(files, options), screenRoute(path), openScreen());
}
export function chromeScreen(files: Parameters<typeof renderRouter>[0], path = "/notes/plan.md", options?: BoardFixtureOptions) {
	return screenStory.traits(
		routedScreen(files, path, options),
		screenStory.trait("screen", `the shell finishes opening ${path}`, function* (engine) {
			yield* screenSettles(engine);
			const route = engine.view?.container.querySelector("#doc")?.getAttribute("data-route");
			if (route !== path) {
				return yield* Effect.die(new Error(`The shell settled on ${route} instead of ${path}`));
			}
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
		yield* screenSettles(engine);
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
		yield* screenSettles(engine);
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
		engine.heldRead = { gate, started: false, startedSignal: yield* Deferred.make<void>(), url };
		yield* Effect.addFinalizer(() => Deferred.succeed(gate, undefined));
	});
}

export function goalsScreen(files?: Parameters<typeof goalsContent>[0]) {
	return screenStory.trait("screen", "the reader opens the goals", function* (engine) {
		const content = yield* goalsContent(files);
		trackScreen(engine, yield* Effect.promise(() => render(content)), (line) => engine.tell?.(line));
		yield* screenSettles(engine);
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
		yield* screenSettles(engine);
	});
}

export function observedLoader(url: string) {
	return screenStory.trait("screen", `the reader observes the loader for ${url}`, (engine) => observeLoader(engine, url));
}
