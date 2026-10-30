import { Deferred, Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, type Screen, typeInput } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { type HeldKind, noticeClient } from "./client.ts";
import { type NoticeScreen, NoticeView } from "./view.tsx";

interface State {
	current: NoticeScreen;
	typed: string;
	view?: Rendered;
}

function view(state: State) {
	if (!state.view) {
		throw new Error("Notice screen is not open");
	}
	return state.view;
}

function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { container } = view(state);
		return settleScreen(container, () => container.querySelector('[data-pending="true"]') !== null, screen.tell);
	});
}

export function noticeVerbs(state: State, screen: Screen) {
	function click(label: string, line: string) {
		return screen.act(line, () => clickButton(view(state).container, label));
	}
	function arrives(kind: HeldKind, title: string, label: string, line: string) {
		const { arrived, finished } = state.current.client.hold(kind, title);
		return screen
			.act(line, async () => {
				clickButton(view(state).container, label);
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
	function interruptsUndo(change: Effect.Effect<void>) {
		return Effect.gen(function* () {
			const { arrivals, hold } = state.current.client;
			const pending = arrivals.restore.map((title) => hold("restore", title).finished);
			yield* change;
			yield* screen.act("wait for the interrupted Undo to end on the server", () => Effect.runPromise(Effect.forEach(pending, Deferred.await)));
			yield* settle(state, screen);
		});
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
		closeHost: () => interruptsUndo(commit({ host: false }, "close the notice host")),
		closeScreens: () => commit({ screens: false }, "close the screens inside the notice host"),
		completeRemove: (title: string) => complete("remove", title, `the server removes ${title}`),
		completeRestore: (title: string) => complete("restore", title, `the server restores ${title}`),
		dismiss: (message: string) => interruptsUndo(click(`Dismiss ${message}`, `dismiss ${message}`)),
		editFirst: () => click("Edit first", "another edit bumps first's version").pipe(Effect.andThen(settle(state, screen))),
		refresh: () => click("Refresh", "refresh the notes").pipe(Effect.andThen(settle(state, screen))),
		remove: (title: string) => arrives("remove", title, `Remove ${title}`, `remove ${title}`),
		renderAgain: () => commit({}, "render the screen again"),
		reopenHost: () => commit({ host: true }, "open the notice host again"),
		replaceSession: (session: string) => commit({ session }, `${session}'s session replaces alice's`),
		saveEditor: () => arrives("remove", "existing", "Save editor", "save the editor"),
		submitForm: () => arrives("remove", state.typed, "Submit form", `submit the form with ${state.typed}`),
		type: (title: string) =>
			screen.act(`type ${title}`, () => {
				state.typed = title;
				typeInput(view(state).container, "title", title);
			}),
		undo: (title: string) => arrives("restore", title, `Undo ${title}`, `undo the removal of ${title}`),
	};
}

export const notifications = storyKit(
	screenKit(
		"notice host",
		(): State => ({
			current: { client: noticeClient(), editor: false, host: true, queryFailure: false, screens: true, session: "alice", uninterruptible: false },
			typed: "blocked",
		}),
		(state, screen) => ({
			...noticeVerbs(state, screen),
			clickPendingUndo: (title: string) =>
				screen.act(`click the pending Undo ${title} again`, () => clickButton(view(state).container, `Undo ${title}`)),
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
			noticeExpires: (message: string) => {
				screen.tell(`${message} reaches its expiry`);
				const { arrivals, hold } = state.current.client;
				const pending = arrivals.restore.map((title) => hold("restore", title).finished);
				return screen
					.act("wait for the interrupted Undo to end on the server", () => Effect.runPromise(Effect.forEach(pending, Deferred.await)))
					.pipe(Effect.andThen(settle(state, screen)));
			},
			notices: () => Effect.sync(() => [...view(state).container.querySelectorAll("article")].map((entry) => entry.querySelector("p")?.textContent)),
			removals: () => Effect.sync(() => [...state.current.client.arrivals.remove]),
			restoreCalls: () => Effect.sync(() => [...state.current.client.calls]),
			restoresReleased: () => Effect.sync(() => [...state.current.client.released]),
			rows: () => Effect.sync(() => view(state).container.querySelector("[data-rows]")?.textContent),
		}),
	),
);

interface Engine {
	readonly screen: Screen;
	readonly state: State;
}

function* open({ screen, state }: Engine, options: Partial<NoticeScreen>) {
	state.current = { ...state.current, ...options };
	state.view = yield* screen.open(<NoticeView state={state.current} />);
	yield* settle(state, screen);
}

function optionWords(options: Partial<NoticeScreen>) {
	const parts = [
		options.editor && "an editor screen",
		options.host === false && "no notice host",
		options.queryFailure && "a query whose first load fails",
		options.uninterruptible && "uninterruptible Undo",
		options.expiresIn !== undefined && `notices that expire after ${options.expiresIn} ms`,
	].filter(Boolean);
	return parts.length === 0 ? "" : ` with ${parts.join(", ")}`;
}

export function noticeScreen(options: Partial<NoticeScreen> = {}) {
	return notifications.trait("screen", `alice's notes${optionWords(options)}, showing existing`, (engine) => open(engine, options));
}

export function removalNoticed(title: string, options: Partial<NoticeScreen> = {}) {
	return notifications.trait("screen", `alice removed ${title}${optionWords(options)} and holds its Removed ${title} notice`, function* (engine) {
		yield* open(engine, options);
		const { completeRemove, remove } = noticeVerbs(engine.state, engine.screen);
		yield* remove(title);
		yield* completeRemove(title);
	});
}

export function undoWaiting(title: string, options: Partial<NoticeScreen> = {}) {
	return notifications.trait("screen", `alice removed ${title}${optionWords(options)} and the server holds her Undo`, function* (engine) {
		yield* open(engine, options);
		const { completeRemove, remove, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove(title);
		yield* completeRemove(title);
		yield* undo(title);
	});
}

export function conflictingUndoWaiting() {
	return notifications.trait("screen", "alice removed first, another edit bumped its version, and the server holds her Undo", function* (engine) {
		yield* open(engine, {});
		const { completeRemove, editFirst, remove, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* completeRemove("first");
		yield* editFirst();
		yield* undo("first");
	});
}

export function twoRemovalNotices() {
	return notifications.trait("screen", "alice removed second and then first, and holds both notices", function* (engine) {
		yield* open(engine, {});
		const { completeRemove, remove } = noticeVerbs(engine.state, engine.screen);
		yield* remove("second");
		yield* completeRemove("second");
		yield* remove("first");
		yield* completeRemove("first");
	});
}

export function undoInterruptedByClosingHost() {
	return notifications.trait("screen", "alice closed the notice host while the server held her Undo of first", function* (engine) {
		yield* open(engine, {});
		const { closeHost, completeRemove, remove, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* completeRemove("first");
		yield* undo("first");
		yield* closeHost();
	});
}

export function undoHeldAcrossSessionChange() {
	return notifications.trait("screen", "alice's uninterruptible Undo of first is held while bob's session replaces hers", function* (engine) {
		yield* open(engine, { uninterruptible: true });
		const { completeRemove, remove, replaceSession, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* completeRemove("first");
		yield* undo("first");
		yield* replaceSession("bob");
	});
}

export function twoRemovalsHeld(secondCompleted: boolean) {
	const second = secondCompleted ? ", and second has completed" : "";
	return notifications.trait("screen", `alice removed first and then second, both held by the server${second}`, function* (engine) {
		yield* open(engine, {});
		const { completeRemove, remove } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* remove("second");
		if (secondCompleted) {
			yield* completeRemove("second");
		}
	});
}

export function removalHeldAcrossSessionChange() {
	return notifications.trait("screen", "alice's removal of first is held while bob's session replaces hers", function* (engine) {
		yield* open(engine, {});
		const { remove, replaceSession } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* replaceSession("bob");
	});
}

export function refreshFailed() {
	return notifications.trait("screen", "alice's notes refreshed against a failing server and published Refresh failed", function* (engine) {
		yield* open(engine, {});
		yield* noticeVerbs(engine.state, engine.screen).breakRefresh();
	});
}

export function formSubmitted(title: string) {
	return notifications.trait("screen", `alice submitted the form with ${title} and the server holds it`, function* (engine) {
		yield* open(engine, {});
		const { submitForm, type } = noticeVerbs(engine.state, engine.screen);
		yield* type(title);
		yield* submitForm();
	});
}
