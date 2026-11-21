import { Deferred, Effect } from "effect";
import type { HeldKind } from "#test/notices/client.ts";
import { type State, settle, view } from "#test/notices/state.ts";
import { type NoticeScreen, NoticeView } from "#test/notices/view.tsx";
import type { Screen } from "#test/Screen.ts";

export const interruptsUndo = Effect.fn("Notices.interruptsUndo")(function* (state: State, screen: Screen, change: Effect.Effect<void>) {
	const { arrivals, hold } = state.current.client;
	const pending = arrivals.restore.map((title) => hold("restore", title).finished);
	yield* change;
	yield* screen.act("wait for the interrupted Undo to end on the server", () => Effect.runPromise(Effect.forEach(pending, Deferred.await)));
	yield* settle(state, screen);
});

export function noticeVerbs(state: State, screen: Screen) {
	function click(label: string, line: string) {
		screen.tell(line);
		return screen.driver(view(state).container).click({ name: label, role: "button" });
	}
	function arrives(kind: HeldKind, title: string, label: string, line: string) {
		const { arrived, finished } = state.current.client.hold(kind, title);
		return screen
			.act(line, async () => {
				await Effect.runPromise(screen.driver(view(state).container).click({ name: label, role: "button" }));
				await Effect.runPromise(Deferred.await(title === "blocked" ? finished : arrived));
			})
			.pipe(Effect.andThen(settle(state, screen)));
	}
	function complete(kind: HeldKind, title: string, line: string) {
		const { finished, gate } = state.current.client.hold(kind, title);
		return screen
			.act(line, async () => {
				Deferred.doneUnsafe(gate, Effect.void);
				await Effect.runPromise(Deferred.await(finished));
			})
			.pipe(Effect.andThen(settle(state, screen)));
	}
	function commit(changes: Partial<NoticeScreen>, line: string) {
		return screen
			.act(line, async () => {
				state.current = { ...state.current, ...changes };
				await view(state).render(<NoticeView state={state.current} />);
			})
			.pipe(Effect.andThen(settle(state, screen)));
	}
	return {
		breakRefresh: () => click("Break refresh", "the server's reads start failing and the notes refresh").pipe(Effect.andThen(settle(state, screen))),
		closeHost: () => interruptsUndo(state, screen, commit({ host: false }, "close the notice host")),
		closeScreens: () => commit({ screens: false }, "close the screens inside the notice host"),
		completeRemove: (title: string) => complete("remove", title, `the server removes ${title}`),
		completeRestore: (title: string) => complete("restore", title, `the server restores ${title}`),
		dismiss: (message: string) => interruptsUndo(state, screen, click(`Dismiss ${message}`, `dismiss ${message}`)),
		editFirst: () => click("Edit first", "another edit bumps first's version").pipe(Effect.andThen(settle(state, screen))),
		refresh: () => click("Refresh", "refresh the notes").pipe(Effect.andThen(settle(state, screen))),
		remove: (title: string) => arrives("remove", title, `Remove ${title}`, `remove ${title}`),
		renderAgain: () => commit({}, "render the screen again"),
		reopenHost: () => commit({ host: true }, "open the notice host again"),
		replaceSession: (session: string) => commit({ session }, `${session}'s session replaces alice's`),
		saveEditor: () => arrives("remove", "existing", "Save editor", "save the editor"),
		submitForm: () => arrives("remove", state.typed, "Submit form", `submit the form with ${state.typed}`),
		type: (title: string) =>
			screen.act(`type ${title}`, async () => {
				state.typed = title;
				await Effect.runPromise(screen.driver(view(state).container).enter('input[name="title"]', title));
			}),
		undo: (title: string) => arrives("restore", title, `Undo ${title}`, `undo the removal of ${title}`),
	};
}
