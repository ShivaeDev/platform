import { Deferred, Effect } from "effect";
import { startTransition } from "react";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { clickButton } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { completionClient, Rejected, Unauthorized } from "./client.ts";
import { type CompletionScreen, CompletionView } from "./view.tsx";

interface State {
	current: CompletionScreen;
	view?: Rendered;
}
function view(state: State) {
	if (!state.view) {
		throw new Error("Command screen is not open");
	}
	return state.view;
}
export const commands = storyKit(
	screenKit(
		"command completions",
		(): State => ({
			current: {
				attempts: [],
				callback: "original",
				client: completionClient(),
				concurrent: false,
				defect: false,
				notices: [],
				rechecks: 0,
				session: "alice",
				uninterruptible: false,
			},
		}),
		(state, screen) => ({
			click: (title: string) => screen.act(`dispatch ${title}`, () => clickButton(view(state).container, title)),
			complete: (title: string, value: string) =>
				screen.act(`complete ${title}`, () => Effect.runPromise(Deferred.succeed(state.current.client.gate(title), value))),
			reject: (title: string, unauthorized = false) =>
				screen.act(`reject ${title}`, () =>
					Effect.runPromise(Deferred.fail(state.current.client.gate(title), unauthorized ? new Unauthorized() : new Rejected({ reason: "Locked" }))),
				),
			render: (changes: Partial<CompletionScreen> = {}) =>
				screen.act("commit the command screen", async () => {
					state.current = { ...state.current, ...changes };
					await view(state).render(<CompletionView state={state.current} />);
				}),
			snapshot: () => ({
				attempts: state.current.attempts,
				calls: state.current.client.calls,
				cause: view(state).container.querySelector("pre")?.textContent,
				finished: state.current.client.finished,
				invalidations: state.current.client.invalidations(),
				notices: [...state.current.notices],
				pending: view(state).container.querySelector("output")?.getAttribute("data-pending"),
				queryPending: view(state).container.querySelector("output")?.getAttribute("data-query-pending"),
				reads: state.current.client.reads(),
				rechecks: state.current.rechecks,
				result: view(state).container.querySelector("output")?.textContent,
			}),
			suspend: () =>
				screen.act("start an uncommitted callback render", () => {
					const next = { ...state.current, callback: "uncommitted", suspend: new Promise<void>(() => undefined) };
					startTransition(() => {
						void view(state).render(<CompletionView state={next} />);
					});
				}),
		}),
	),
);
export function commandScreen(options: Partial<CompletionScreen> = {}) {
	return commands.trait("screen", "native runtime and held contract commands", function* ({ state, screen }) {
		state.current = { ...state.current, ...options };
		state.view = yield* screen.open(<CompletionView state={state.current} />);
	});
}
