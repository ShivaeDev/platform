import { flushSync } from "react-dom";
import { passageStatus, revealPassage, scrollToPassage } from "#client/react/readingPassage.ts";
import { type captureReading, restoreReading } from "#client/react/readingState.ts";
export function scheduleReading(
	doc: HTMLElement,
	reading: ReturnType<typeof captureReading> | null,
	hash: string,
	active: () => boolean,
	setStatus: (status: string) => void,
	focus: boolean,
) {
	function restore() {
		if (!active()) {
			return;
		}
		if (focus && !document.activeElement?.closest("[data-response-form], #response-form, #handoff-form")) {
			doc.focus({ preventScroll: true });
		}
		const passage = hash ? `#${hash}` : "";
		if (reading) {
			restoreReading(reading);
		}
		// Readiness can arrive from a React effect; reveal the target before scrolling or focusing it.
		queueMicrotask(() => {
			if (!active()) {
				return;
			}
			flushSync(() => revealPassage(passage));
			if (reading) {
				flushSync(() => setStatus(passageStatus(passage)));
			} else {
				setStatus(scrollToPassage(passage));
			}
		});
	}
	requestAnimationFrame(restore);
}
