import { attachResponses } from "./attach.ts";
export function setupResponses() {
	document.addEventListener("board-page", attachResponses);
	window.addEventListener("pageshow", attachResponses);
	attachResponses();
}
