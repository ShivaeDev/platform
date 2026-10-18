import { act } from "react";
import type { ReadingState } from "#client/react/readingState.ts";
import { scheduleReading } from "#client/react/scheduleReading.ts";
import { control } from "./chrome.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function motionActions(engine: ScreenEngine, tell: (line: string) => void) {
	function motion() {
		if (!engine.motion) {
			throw new Error("Browser motion is not observed in this story");
		}
		return engine.motion;
	}
	return {
		clearMotion: () => {
			tell("the browser begins a new motion observation");
			for (const spy of Object.values(motion())) {
				spy.mockClear();
			}
		},
		queueReading: (reading: ReadingState, hash: string) => {
			tell(`the reader restores the saved passage ${hash}`);
			engine.readingStatus = [];
			act(() =>
				scheduleReading(
					control("#doc", HTMLElement),
					reading,
					hash,
					() => true,
					(status) => engine.readingStatus?.push(status),
					false,
				),
			);
		},
		readMotion: (kind: "focus" | "passage" | "scroll") => {
			tell(`the reader inspects browser ${kind} requests`);
			return motion()[kind].mock.calls;
		},
		readPassageTargets: () => {
			tell("the reader checks which elements the browser scrolled into view");
			return motion().passage.mock.contexts.map((element) => (element instanceof HTMLElement ? element.id : undefined));
		},
		readReadingStatus: () => {
			tell("the reader reads the restoration status");
			return engine.readingStatus;
		},
		readScrollAnchoring: () => {
			tell("the reader checks browser scroll anchoring");
			return document.documentElement.style.overflowAnchor;
		},
		readScrollPosition: () => {
			tell("the reader checks the scroll position");
			return window.scrollY;
		},
		rememberHistory: (state: unknown) => {
			tell("the browser retains the current history entry");
			window.history.replaceState(state, "");
		},
		setScrollPosition: (position: number) => {
			tell(`the reader scrolls to ${position}`);
			engine.scrollPosition = position;
		},
	};
}
