import { Clock, Deferred, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { TestClock } from "effect/testing";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, typeInput } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { noticeClient } from "./client.ts";
import { type NoticeScreen, NoticeView } from "./view.tsx";

interface State {
	clock?: Clock.Clock;
	current: NoticeScreen;
	view?: Rendered;
}
function view(state: State) {
	if (!state.view) {
		throw new Error("Notice screen is not open");
	}
	return state.view;
}
export const notifications = storyKit({
	...screenKit(
		"notice host",
		(): State => ({
			current: { client: noticeClient(), editor: false, host: true, queryFailure: false, screens: true, session: "alice", uninterruptible: false },
		}),
		(state, screen) => ({
			advance: (millis: number) => {
				const clock = state.clock;
				if (!clock) {
					throw new Error("The notice host has no clock");
				}
				return screen.act(`the host's clock advances ${millis} ms`, () =>
					Effect.runPromise(TestClock.adjust(millis).pipe(Effect.provideService(Clock.Clock, clock))),
				);
			},
			click: (label: string) => screen.act(label, () => clickButton(view(state).container, label)),
			complete: (kind: "remove" | "restore", title: string) =>
				screen.act(`complete ${kind} ${title}`, () => Effect.runPromise(Deferred.succeed(state.current.client.gate(kind, title), undefined))),
			render: (changes: Partial<NoticeScreen>) =>
				screen.act("render the session", async () => {
					state.current = { ...state.current, ...changes };
					await view(state).render(<NoticeView state={state.current} />);
				}),
			snapshot: () => ({
				calls: [...state.current.client.calls],
				command: view(state).container.querySelector("[data-command]")?.textContent,
				notices: [...view(state).container.querySelectorAll("article")].map((entry) => ({
					message: entry.querySelector("p")?.textContent,
					outcome: entry.querySelector("output")?.textContent,
					pending: entry.querySelector("button")?.disabled,
				})),
				released: [...state.current.client.released],
				rows: view(state).container.querySelector("[data-rows]")?.textContent,
				started: [...state.current.client.removals.keys()],
			}),
			type: (title: string) => screen.act(`type ${title}`, () => typeInput(view(state).container, "title", title)),
			unmount: () => screen.act("unmount the host", () => view(state).unmount()),
		}),
	),
	clock: "test",
});
export function noticeScreen(options: Partial<NoticeScreen> = {}) {
	return notifications.trait("screen", "session with application-rendered notices", function* ({ screen, state }) {
		state.clock = yield* Clock.Clock;
		state.current = { ...state.current, clock: Atom.runtime(Layer.succeed(Clock.Clock, state.clock)), ...options };
		state.view = yield* screen.open(<NoticeView state={state.current} />);
	});
}
