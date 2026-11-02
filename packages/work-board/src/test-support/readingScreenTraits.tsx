import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { readingReadyScreen } from "./readingReadyScreen.tsx";
import { recordClipboard } from "./readingScreenReads.ts";
import { followFrames, framesSettle, holdLaterRead, readingSettles } from "./readingSettle.ts";
import { screenStory } from "./screenStory.ts";
import { routedScreen } from "./screenTraits.ts";

export function framesFollowed() {
	return screenStory.trait("workspace", "the browser reports the animation frames the page still waits for", (engine) => followFrames(engine));
}

export function readingPage(files: Readonly<Record<string, string>>, path: string, options?: BoardFixtureOptions) {
	return screenStory.traits(
		framesFollowed(),
		routedScreen(files, path, options),
		screenStory.trait("screen", `the page finishes rendering ${path} and placing the reader`, (engine) => readingSettles(engine)),
	);
}

export function clipboardRecorded() {
	return screenStory.trait("workspace", "the clipboard accepts what the reader copies", (engine) => recordClipboard(engine));
}

export function readinessHeld() {
	return screenStory.traits(
		framesFollowed(),
		readingReadyScreen(),
		screenStory.trait("screen", "the page finishes the frames it asked for while the document holds back its readiness", (engine) =>
			framesSettle(engine),
		),
	);
}

export function laterReadHeld(url: string) {
	return screenStory.trait("workspace", `the document read for ${url} waits once the reader opens it`, (engine) => holdLaterRead(engine, url));
}
