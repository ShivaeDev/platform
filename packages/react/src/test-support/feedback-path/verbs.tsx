import { Deferred, Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import type { Notice } from "#notices.ts";
import { Rejected } from "#test/notices/Api.ts";
import { type HeldKind, noticeClient } from "#test/notices/client.ts";
import { clickButton, type Screen, submitForm, typeInput } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { type FeatureScreen, FeedbackView } from "./view.tsx";

export type Session = "alice" | "bob";

export interface State {
	current: FeatureScreen;
	retained?: Notice;
	readonly sessions: Map<string, FeatureScreen>;
	typed: string;
	typedSaved?: string;
	view?: Rendered;
}

export function view(state: State) {
	if (!state.view) {
		throw new Error("The notes feature is not open");
	}
	return state.view;
}

export function session(state: State, name: string = state.current.session) {
	const found = state.sessions.get(name);
	if (!found) {
		throw new Error(`The ${name} session is not open`);
	}
	return found;
}

export function generation(name: string, uninterruptible: boolean): FeatureScreen {
	return {
		callbacks: [],
		client: noticeClient({ holdReads: true }),
		finished: [],
		notices: new Map(),
		registries: [],
		session: name,
		uninterruptible,
	};
}

function button(state: State, label: string) {
	return [...view(state).container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
}

export function feedbackVerbs(state: State, screen: Screen) {
	function settle(pending: () => boolean) {
		return Effect.suspend(() => settleScreen(view(state).container, pending, screen.tell));
	}
	function listPending() {
		return button(state, "Refresh")?.disabled === true;
	}
	function saving() {
		return view(state).container.querySelector<HTMLButtonElement>("form button")?.disabled === true;
	}
	function readStarts(line: string, run: () => void) {
		const read = session(state).client.nextRead();
		return screen.act(line, async () => {
			run();
			await read;
		});
	}
	function arrives(kind: HeldKind, title: string, line: string, run: () => void) {
		const { arrived, finished } = session(state).client.hold(kind, title);
		const blocked = title === "blocked";
		return screen
			.act(line, async () => {
				run();
				await Effect.runPromise(Deferred.await(blocked ? finished : arrived));
			})
			.pipe(Effect.andThen(blocked ? settle(saving) : Effect.void));
	}
	function release(kind: HeldKind, title: string, name: string | undefined, line: string, refetches: boolean) {
		const owner = session(state, name);
		const { finished, gate } = owner.client.hold(kind, title);
		const read = refetches ? owner.client.nextRead() : Promise.resolve();
		return screen.act(line, async () => {
			Deferred.doneUnsafe(gate, Effect.void);
			await Effect.runPromise(Deferred.await(finished));
			await read;
		});
	}
	function answer(line: string, outcome: Effect.Effect<void, Rejected>) {
		return Effect.suspend(() => {
			const read = session(state).client.reads.at(-1);
			if (!read) {
				throw new Error("No read has started");
			}
			return screen.act(line, () => Effect.runPromise(Deferred.complete(read, outcome)));
		}).pipe(Effect.andThen(settle(listPending)));
	}
	return {
		answerRead: () => answer("the server answers the latest read", Effect.void),
		completeRemove: (title: string, name?: Session) =>
			release(
				"remove",
				title,
				name,
				`the server removes ${title}${name ? ` for ${name}` : ""}`,
				name === undefined || name === state.current.session,
			),
		completeRestore: (title: string, name?: Session) =>
			release("restore", title, name, `the server restores ${title}${name ? ` for ${name}` : ""}`, false).pipe(
				Effect.andThen(settle(() => button(state, `Undo ${title}`)?.disabled === true)),
			),
		completeSave: () =>
			Effect.suspend(() => {
				const title = state.typedSaved ?? "";
				return release("save", title, undefined, `the server saves ${title}`, true);
			}).pipe(Effect.andThen(settle(saving))),
		editFirst: () => readStarts("another edit bumps first's version", () => clickButton(view(state).container, "Edit first")),
		failRead: () => answer("the server fails the latest read", Effect.fail(new Rejected())),
		refresh: () => readStarts("refresh the notes", () => clickButton(view(state).container, "Refresh")),
		remove: (title: string) => arrives("remove", title, `remove ${title}`, () => clickButton(view(state).container, `Remove ${title}`)),
		replaceSession: (name: Session) => {
			const next = generation(name, state.current.uninterruptible);
			const read = next.client.nextRead();
			return screen
				.act(`${name}'s session replaces ${state.current.session}'s`, async () => {
					state.current = next;
					state.sessions.set(name, next);
					await view(state).render(<FeedbackView state={next} />);
				})
				.pipe(Effect.andThen(screen.act(`wait for ${name}'s first read to reach the server`, () => read)));
		},
		retainNotice: (message: string) =>
			Effect.sync(() => {
				const notice = state.current.notices.get(message);
				if (!notice) {
					throw new Error(`Notice ${message} is missing`);
				}
				state.retained = notice;
			}),
		retry: () => readStarts("retry the notes", () => clickButton(view(state).container, "Retry")),
		submit: () =>
			Effect.suspend(() => {
				state.typedSaved = state.typed;
				return arrives("save", state.typed, `save the note ${state.typed}`, () => submitForm(view(state).container));
			}),
		type: (title: string) =>
			screen.act(`type ${title}`, () => {
				state.typed = title;
				typeInput(view(state).container, "title", title);
			}),
		undo: (title: string) => arrives("restore", title, `undo the removal of ${title}`, () => clickButton(view(state).container, `Undo ${title}`)),
	};
}
