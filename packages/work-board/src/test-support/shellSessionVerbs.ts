import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenAct } from "./screenAct.ts";
import type { ScreenEngine } from "./screenEngine.ts";

const SCREEN_LIMIT_MS = 10_000;
const NOT_ANSWERING = "The Board server isn't answering";
const UNREACHABLE = "Can't reach the Board server";

// A live session keeps its update stream open and retries while the Board server is down, so its screen never settles; these verbs settle on what the reader sees instead.
export function untilScreen(tell: (line: string) => void, shown: () => boolean) {
	return screenDriver({ act: screenAct, pending: () => !shown(), root: () => document.body, tell }).settle({
		timeoutMs: SCREEN_LIMIT_MS,
	});
}

function page() {
	return document.querySelector<HTMLElement>("#doc");
}

function notAnswering(route: string) {
	return () =>
		page()?.dataset.route === route
		&& page()?.querySelector("[data-slot=empty-title]")?.textContent === NOT_ANSWERING
		&& document.querySelector("#breadcrumbs")?.textContent !== "";
}

export function livePageShown() {
	return () => page()?.dataset.status !== undefined && document.querySelector("#live")?.textContent === "Live";
}

export function shellSessionVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		boardServerAnswers: () =>
			Effect.promise(async () => {
				tell("the Board server answers again and the page opens");
				await act(() => {
					engine.serverStopped = false;
					return Promise.resolve();
				});
			}).pipe(Effect.andThen(untilScreen(tell, livePageShown()))),
		boardServerStops: () =>
			Effect.promise(async () => {
				tell("the Board server stops answering and the header says so");
				await act(() => {
					engine.serverStopped = true;
					engine.sessionDisconnect?.();
					return Promise.resolve();
				});
			}).pipe(Effect.andThen(untilScreen(tell, () => document.querySelector("#live")?.textContent === UNREACHABLE))),
		followWhileServerDown: (href: string) =>
			Effect.promise(async () => {
				tell(`the reader follows ${href} while the Board server isn't answering`);
				const link = document.createElement("a");
				link.href = href;
				document.body.append(link);
				try {
					await act(async () => link.click());
				} finally {
					link.remove();
				}
			}).pipe(Effect.andThen(untilScreen(tell, notAnswering(href)))),
		pageReadBesideDaemon: () =>
			Effect.promise(async () => {
				tell("the page reads the Board while the Board server reads the Fleet daemon");
				if (!engine.session || engine.sessionFleetPort === undefined) {
					throw new Error("The session has no story Fleet daemon");
				}
				const origin = engine.session.environment.location.origin;
				const pageRead = fetch(`${origin}/`);
				await fetch(`http://127.0.0.1:${engine.sessionFleetPort}/`).catch(() => undefined);
				return pageRead.then(
					(response) => (response.ok ? "read" : `answered ${response.status}`),
					(error: unknown) => String(error),
				);
			}),
	};
}
