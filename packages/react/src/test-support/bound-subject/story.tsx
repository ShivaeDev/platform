import { Effect } from "effect";
import { activityScreenSignal } from "@shivaedev/contract/clientActivity.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { CoachScreen } from "#test/bound-subject/CoachScreen.tsx";
import { connect, type JournalClient } from "#test/bound-subject/connect.ts";
import { openHost } from "#test/bound-subject/openHost.ts";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

interface State {
	open?: { readonly client: JournalClient; readonly view: Rendered };
}

function opened(state: State) {
	if (!state.open) {
		throw new Error("The journal screen is not open");
	}
	return state.open;
}

function driver(state: State, screen: Screen) {
	const { client, view } = opened(state);
	return screen.driver(view.container, activityScreenSignal(client.activity));
}

export const subjectScreen = storyKit(
	screenKit(
		"one screen over a coach's plain client and the same client bound to dana",
		(): State => ({}),
		(state, screen) => ({
			journal: (whose: "own" | "dana") =>
				Effect.sync(() => opened(state).view.container.querySelector(`[data-journal="${whose}"]`)?.textContent ?? "missing"),
			logsRanFiveK: () =>
				driver(state, screen)
					.click({ name: "Log Ran 5k", role: "button" })
					.pipe(Effect.andThen(driver(state, screen).settle())),
			writes: (entry: string) =>
				driver(state, screen)
					.enter('input[name="entry"]', entry)
					.pipe(Effect.andThen(driver(state, screen).submit()), Effect.andThen(driver(state, screen).settle())),
		}),
	),
);

export const journalScreenOpen = subjectScreen.trait(
	"screen",
	"the coach's screen shows their own journal and dana's, and writes dana's",
	function* ({ screen, state }) {
		const host = yield* openHost;
		const client = connect(host.url, yield* storyRuntime);
		const view = yield* screen.open(<CoachScreen client={client} />);
		state.open = { client, view };
		yield* driver(state, screen).settle();
	},
);
