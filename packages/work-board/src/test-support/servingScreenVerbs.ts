import { Effect } from "effect";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

const PROBLEM = "#doc [data-slot=empty-description]";

function problemText() {
	return document.querySelector(PROBLEM)?.textContent || undefined;
}

// A live session keeps its socket subscription pending, so the screen never settles; the problem text is awaited through the DOM's own mutation signal instead.
function problemShown() {
	return Effect.callback<string>((resume) => {
		const shown = problemText();
		if (shown !== undefined) {
			resume(Effect.succeed(shown));
			return;
		}
		const observer = new MutationObserver(() => {
			const text = problemText();
			if (text !== undefined) {
				observer.disconnect();
				resume(Effect.succeed(text));
			}
		});
		observer.observe(document.body, { characterData: true, childList: true, subtree: true });
		return Effect.sync(() => observer.disconnect());
	}).pipe(
		Effect.timeoutOrElse({
			duration: "10 seconds",
			orElse: () => Effect.die(new Error(`The work view showed no problem: ${document.querySelector("#doc")?.textContent ?? "no #doc"}`)),
		}),
	);
}

export function servingScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		appliedScheme: () =>
			Effect.sync(() => {
				tell("the reader checks which colour scheme the page applied");
				const root = document.documentElement;
				const scheme = root.getAttribute("data-scheme");
				const dark = root.classList.contains("dark");
				return dark === (scheme === "dark") ? scheme : `data-scheme ${scheme} but the dark class is ${dark ? "set" : "missing"}`;
			}),
		outlinedSidebar: () =>
			Effect.sync(() => {
				tell("the reader checks how the page outlines the sidebar");
				return document.documentElement.getAttribute("data-sidebar");
			}),
		workViewProblem: () =>
			Effect.gen(function* () {
				if (!engine.session) {
					yield* screenSettles(engine, tell);
				}
				tell("the reader reads the problem the work view explains");
				return yield* problemShown();
			}),
	};
}
