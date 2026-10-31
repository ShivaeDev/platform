import { Effect } from "effect";

export function preferenceVerbs(tell: (line: string) => void) {
	return {
		preferenceNotice: () =>
			Effect.sync(() => {
				tell("the reader reads the note under the appearance choices");
				return document.querySelector("#preference-status")?.textContent ?? "none";
			}),
	};
}
