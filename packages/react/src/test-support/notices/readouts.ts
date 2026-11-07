import { Effect } from "effect";
import { type State, view } from "#test/notices/state.ts";

export function noticeReadouts(state: State) {
	return {
		commandShown: () => Effect.sync(() => view(state).container.querySelector("[data-command]")?.textContent),
		notice: (message: string) =>
			Effect.sync(() => {
				const entry = [...view(state).container.querySelectorAll("article")].find(
					(candidate) => candidate.querySelector("p")?.textContent === message,
				);
				if (entry === undefined) {
					return "missing";
				}
				const undo = entry.querySelector("button");
				return { outcome: entry.querySelector("output")?.textContent?.split("\n")[0] ?? "", undo: undo?.disabled ? "pending" : "ready" };
			}),
		notices: () => Effect.sync(() => [...view(state).container.querySelectorAll("article")].map((entry) => entry.querySelector("p")?.textContent)),
		removals: () => Effect.sync(() => [...state.current.client.arrivals.remove]),
		restoreCalls: () => Effect.sync(() => [...state.current.client.calls]),
		restoresReleased: () => Effect.sync(() => [...state.current.client.released]),
		rows: () => Effect.sync(() => view(state).container.querySelector("[data-rows]")?.textContent),
	};
}
