import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { screenPending } from "#adapters/screenPending.ts";
import { liveLoaderHost } from "#test/live-loader/host.ts";
import { LiveNote } from "#test/live-screen/LiveNote.tsx";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";

export const liveScreen = storyKit({
	clock: "test",
	*create() {
		const host = yield* liveLoaderHost();
		const screen = new Screen(() => undefined);
		const view = yield* screen.open();
		const pending = yield* screenPending().pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
		return { host, pending, screen, view };
	},
	inspect: ({ host, view }) => ({ calls: host.calls, screen: view.container.textContent, subscriptions: host.subscriptions() }),
	name: "live query screen",
	stages: ["screen"],
	verbs: ({ host, pending, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			respond: (title: string) =>
				screen.act(`the server answers ${title}`, () => host.respond(title)).pipe(Effect.andThen(settleScreen(view.container, pending, story.tell))),
			screenWork: () => Effect.sync(() => (pending() ? "pending" : "settled")),
			shownTitle: () => Effect.sync(() => view.container.querySelector("h1")?.textContent),
			subscriptions: () => Effect.sync(() => host.subscriptions()),
		};
	},
});

export const liveNoteAwaitingFirstAnswer = liveScreen.trait(
	"screen",
	"the screen shows a live note query whose subscription has asked the server for its first answer",
	({ host, screen, view }) =>
		screen.act("open the live note screen", () => view.render(<LiveNote atom={host.atom} />)).pipe(Effect.andThen(host.started)),
);
