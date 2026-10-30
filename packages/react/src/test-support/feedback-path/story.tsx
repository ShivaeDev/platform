import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { feedbackVerbs, generation, type Session, type State, session, view } from "./verbs.tsx";
import { FeedbackView } from "./view.tsx";

export const feedback = storyKit(
	screenKit(
		"notes feedback feature",
		(): State => ({ current: generation("alice", false), sessions: new Map(), typed: "" }),
		(state, screen) => {
			function text(selector: string) {
				return Effect.sync(() => view(state).container.querySelector(selector)?.textContent ?? "none");
			}
			return {
				...feedbackVerbs(state, screen),
				callbacks: (name?: Session) => Effect.sync(() => [...session(state, name).callbacks]),
				dismissRetainedNotice: () =>
					screen.act("dismiss alice's retained notice", () => {
						if (!state.retained) {
							throw new Error("No notice was retained");
						}
						state.retained.dismiss();
					}),
				draft: () => Effect.sync(() => view(state).container.querySelector<HTMLInputElement>("input")?.value),
				fieldError: () => text("form [role=alert]"),
				heldAtoms: (name: Session) =>
					Effect.sync(() => (session(state, name).registries.some((registry) => registry.getNodes().size > 0) ? "holds atoms" : "empty")),
				loading: () => text("[data-loading]"),
				notice: (message: string) =>
					Effect.sync(() => {
						const entry = [...view(state).container.querySelectorAll("article")].find(
							(candidate) => candidate.querySelector("p")?.textContent === message,
						);
						return entry === undefined ? "missing" : (entry.querySelector("output")?.textContent?.split("\n")[0] ?? "");
					}),
				notices: () =>
					Effect.sync(() => [...view(state).container.querySelectorAll("article")].map((entry) => entry.querySelector("p")?.textContent)),
				queryError: () => text("main > [role=alert]"),
				reads: (name?: Session) => Effect.sync(() => session(state, name).client.reads.length),
				restoreCalls: (name?: Session) => Effect.sync(() => [...session(state, name).client.calls]),
				restoresReleased: (name?: Session) => Effect.sync(() => [...session(state, name).client.released]),
				rows: () => text("[data-rows]"),
				runRetainedAction: () =>
					screen.act("run the Undo of alice's retained notice", () => {
						if (!state.retained?.action) {
							throw new Error("No notice action was retained");
						}
						state.retained.action.run();
					}),
				saveStatus: () => text("form [role=status]"),
				saves: () => Effect.sync(() => [...session(state).client.arrivals.save]),
			};
		},
	),
);

interface Engine {
	readonly screen: Screen;
	readonly state: State;
}

function* open({ screen, state }: Engine, uninterruptible = false) {
	state.current = generation("alice", uninterruptible);
	state.sessions.set("alice", state.current);
	const read = state.current.client.nextRead();
	state.view = yield* screen.open(<FeedbackView state={state.current} />);
	yield* screen.act("wait for the first read to reach the server", () => read);
}

function* shown(engine: Engine, uninterruptible = false) {
	yield* open(engine, uninterruptible);
	yield* feedbackVerbs(engine.state, engine.screen).answerRead();
}

export function notesLoading() {
	return feedback.trait("screen", "alice's notes feature waits on the server's first read", (engine) => open(engine));
}

export function firstLoadFailed() {
	return feedback.trait("screen", "the server failed alice's first read of the notes", function* (engine) {
		yield* open(engine);
		yield* feedbackVerbs(engine.state, engine.screen).failRead();
	});
}

export function notesShown() {
	return feedback.trait("screen", "alice's notes feature shows existing", (engine) => shown(engine));
}

export function notesShownWithDraft(draft: string) {
	return feedback.trait("screen", `alice's notes feature shows existing with the draft ${draft}`, function* (engine) {
		yield* shown(engine);
		yield* feedbackVerbs(engine.state, engine.screen).type(draft);
	});
}

export function refreshWaitingWithDraft(draft: string) {
	return feedback.trait("screen", `alice refreshed her notes with the draft ${draft}, and the server holds the read`, function* (engine) {
		yield* shown(engine);
		const { refresh, type } = feedbackVerbs(engine.state, engine.screen);
		yield* type(draft);
		yield* refresh();
	});
}

export function saveWaitingWithNewerDraft() {
	return feedback.trait("screen", "the server holds alice's save of new note while she types next draft", function* (engine) {
		yield* shown(engine);
		const { submit, type } = feedbackVerbs(engine.state, engine.screen);
		yield* type("new note");
		yield* submit();
		yield* type("next draft");
	});
}

export function saveCompleted() {
	return feedback.trait("screen", "the server saved alice's new note and holds the refetch it caused", function* (engine) {
		yield* shown(engine);
		const { completeSave, submit, type } = feedbackVerbs(engine.state, engine.screen);
		yield* type("new note");
		yield* submit();
		yield* completeSave();
	});
}

export function saveAndTwoRemovalsHeld(secondDone: boolean) {
	const done = secondDone ? ", and second's removal and the save have completed" : "";
	return feedback.trait("screen", `the server holds alice's save of concurrent note and her removals of first and second${done}`, function* (engine) {
		yield* shown(engine);
		const { completeRemove, completeSave, remove, submit, type } = feedbackVerbs(engine.state, engine.screen);
		yield* type("concurrent note");
		yield* submit();
		yield* remove("first");
		yield* remove("second");
		if (secondDone) {
			yield* completeRemove("second");
			yield* completeSave();
		}
	});
}

export function firstUndoConflictingAfterSecondRestored() {
	return feedback.trait(
		"screen",
		"alice removed first and second, restored second, and the server holds her Undo of first after another edit bumped its version",
		function* (engine) {
			yield* shown(engine);
			const { answerRead, completeRemove, completeRestore, editFirst, remove, undo } = feedbackVerbs(engine.state, engine.screen);
			for (const title of ["first", "second"]) {
				yield* remove(title);
				yield* completeRemove(title);
				yield* answerRead();
			}
			yield* undo("second");
			yield* completeRestore("second");
			yield* editFirst();
			yield* answerRead();
			yield* undo("first");
		},
	);
}

function* busyAlice(engine: Engine) {
	yield* shown(engine, true);
	const { completeRemove, remove, retainNotice, type, undo } = feedbackVerbs(engine.state, engine.screen);
	yield* remove("first");
	yield* completeRemove("first");
	yield* retainNotice("Removed first");
	yield* undo("first");
	yield* remove("second");
	yield* type("Alice's draft");
}

export function aliceBusy() {
	return feedback.trait(
		"screen",
		"alice's uninterruptible Undo of first and removal of second are held, with a draft typed and her Removed first notice retained",
		busyAlice,
	);
}

export function bobReplacedBusyAlice(shownToBob: boolean) {
	const read = shownToBob ? " and bob's notes show existing" : ", and the server holds bob's first read";
	return feedback.trait("screen", `bob's session replaced alice's while her work was held${read}`, function* (engine) {
		yield* busyAlice(engine);
		const { answerRead, replaceSession } = feedbackVerbs(engine.state, engine.screen);
		yield* replaceSession("bob");
		if (shownToBob) {
			yield* answerRead();
		}
	});
}

export function bobNoticedAfterBusyAlice() {
	return feedback.trait("screen", "bob's session replaced alice's busy one, and bob removed first and holds his notice", function* (engine) {
		yield* busyAlice(engine);
		const { answerRead, completeRemove, remove, replaceSession } = feedbackVerbs(engine.state, engine.screen);
		yield* replaceSession("bob");
		yield* answerRead();
		yield* remove("first");
		yield* completeRemove("first");
		yield* answerRead();
	});
}
