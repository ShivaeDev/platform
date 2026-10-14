import { flushSync } from "react-dom";
import { type captureReading, passageStatus, restoreReading, scrollToPassage } from "./readingState.ts";
export function scheduleReading(
	doc: HTMLElement,
	reading: ReturnType<typeof captureReading> | null,
	hash: string,
	active: () => boolean,
	setStatus: (status: string) => void,
	focus: boolean,
) {
	let restored = false;
	function restore() {
		if (restored || !active()) {
			document.removeEventListener("board-reading-ready", restore);
			return;
		}
		const context = doc.querySelector<HTMLElement>(".item-context");
		if (context && context.dataset.readingReady !== "true") {
			return;
		}
		restored = true;
		document.removeEventListener("board-reading-ready", restore);
		if (focus && !document.activeElement?.closest("[data-response-form], #response-form, #handoff-form")) {
			doc.focus({ preventScroll: true });
		}
		const passage = hash ? `#${hash}` : "";
		if (reading) {
			restoreReading(reading);
			// Readiness can arrive from a React effect; commit the warning before the next paint.
			queueMicrotask(() => {
				if (active()) {
					flushSync(() => setStatus(passageStatus(passage)));
				}
			});
		} else {
			setStatus(scrollToPassage(passage));
		}
	}
	document.addEventListener("board-reading-ready", restore);
	requestAnimationFrame(restore);
}
