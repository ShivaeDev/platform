import { type captureReading, restoreReading, scrollToPassage } from "./readingState.ts";
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
			document.removeEventListener("board-reading-ready", restore);
			return;
		}
		const context = doc.querySelector<HTMLElement>(".item-context");
		if (context && context.dataset.readingReady !== "true") {
			return;
		}
		document.removeEventListener("board-reading-ready", restore);
		if (focus && !document.activeElement?.closest("#response-form, #handoff-form")) {
			doc.focus({ preventScroll: true });
		}
		if (reading) {
			restoreReading(reading);
			setStatus("");
		} else {
			setStatus(scrollToPassage(hash ? `#${hash}` : ""));
		}
	}
	document.addEventListener("board-reading-ready", restore);
	requestAnimationFrame(restore);
}
