import { Clock, Effect } from "effect";
import { act } from "react";
import { mergedPullRequest } from "./pullRequestsFixture.ts";
import type { ScreenEngine } from "./screenEngine.ts";

const QUIET_MS = 10;
const SETTLE_MS = 10_000;

function liveState() {
	return document.querySelector("#live")?.getAttribute("data-state");
}

// The live page's status reads live once its subscription has delivered and every query it refreshed has answered; a quiet DOM then means React has committed. The wait runs inside act so React applies the pushed updates as it would in a browser.
function settled(refreshed: () => boolean, what: string) {
	return Effect.promise(() => act(() => quietLive(refreshed, what)));
}

function quietLive(refreshed: () => boolean, what: string) {
	return new Promise<void>((resolve, reject) => {
		let quiet: ReturnType<typeof setTimeout> | undefined;
		const observer = new MutationObserver(check);
		const deadline = setTimeout(() => {
			observer.disconnect();
			clearTimeout(quiet);
			reject(new Error(`The live page did not ${what} within ${SETTLE_MS}ms; its live status is ${liveState()}`));
		}, SETTLE_MS);
		function check() {
			clearTimeout(quiet);
			if (refreshed() && liveState() === "live") {
				quiet = setTimeout(() => {
					observer.disconnect();
					clearTimeout(deadline);
					resolve();
				}, QUIET_MS);
			}
		}
		observer.observe(document, { attributes: true, characterData: true, childList: true, subtree: true });
		check();
	});
}

export function liveSessionSignals(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		liveSessionSettles: () =>
			Effect.gen(function* () {
				tell("the live page's status reads Live and its document is quiet");
				yield* settled(() => true, "settle");
			}),
		pullRequestMerged: (workId: string, file: string, source: string) =>
			Effect.gen(function* () {
				tell(`Fleet merges the pull request of ${workId} and an outside editor writes ${file}; the live page refreshes and reads Live again`);
				if (!(engine.session && engine.sessionFleet)) {
					throw new Error("The live session has no Fleet work items");
				}
				let refreshing = false;
				const watch = new MutationObserver(() => {
					refreshing ||= liveState() !== "live";
				});
				const live = document.querySelector("#live");
				if (live) {
					watch.observe(live, { attributeFilter: ["data-state"], attributes: true });
				}
				engine.sessionFleet = mergedPullRequest(engine.sessionFleet, workId, yield* Clock.currentTimeMillis);
				engine.session.notes.write(file, source);
				yield* settled(() => refreshing, "refresh after the merge").pipe(Effect.ensuring(Effect.sync(() => watch.disconnect())));
			}),
	};
}
