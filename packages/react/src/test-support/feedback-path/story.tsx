import { Deferred, Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Notice } from "#notices.ts";
import { Rejected } from "#test/notices/Api.ts";
import { noticeClient } from "#test/notices/client.ts";
import { clickButton, submitForm, typeInput } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { type FeatureScreen, FeedbackView } from "./view.tsx";

interface State {
	current: FeatureScreen;
	retained?: Notice;
	readonly sessions: Map<string, FeatureScreen>;
	view?: Rendered;
}
function view(state: State) {
	if (!state.view) {
		throw new Error("The notes feature is not open");
	}
	return state.view;
}
function session(state: State, name = state.current.session) {
	const found = state.sessions.get(name);
	if (!found) {
		throw new Error(`The ${name} session is not open`);
	}
	return found;
}
function generation(name: string, uninterruptible: boolean): FeatureScreen {
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
function read(state: State, index: number, name?: string) {
	const pending = session(state, name).client.reads[index - 1];
	if (!pending) {
		throw new Error(`Read ${index} has not started`);
	}
	return pending;
}
export const feedback = storyKit(
	screenKit(
		"notes feedback feature",
		(): State => ({ current: generation("alice", false), sessions: new Map() }),
		(state, screen) => ({
			click: (label: string) => screen.act(label, () => clickButton(view(state).container, label)),
			complete: (kind: "remove" | "restore" | "save", title: string, name?: string) =>
				screen.act(`complete ${kind} ${title}`, () => Effect.runPromise(Deferred.succeed(session(state, name).client.gate(kind, title), undefined))),
			dismissRetainedNotice: () =>
				screen.act("dismiss the outgoing notice", () => {
					if (!state.retained) {
						throw new Error("No notice was retained");
					}
					state.retained.dismiss();
				}),
			readFails: (index: number) => screen.act(`read ${index} fails`, () => Effect.runPromise(Deferred.fail(read(state, index), new Rejected()))),
			readSucceeds: (index: number, name?: string) =>
				screen.act(`read ${index} succeeds`, () => Effect.runPromise(Deferred.succeed(read(state, index, name), undefined))),
			replaceSession: (name: string) =>
				screen.act(`replace the session with ${name}`, async () => {
					state.current = generation(name, state.current.uninterruptible);
					state.sessions.set(name, state.current);
					await view(state).render(<FeedbackView state={state.current} />);
				}),
			retainNotice: (message: string) => {
				const notice = state.current.notices.get(message);
				if (!notice) {
					throw new Error(`Notice ${message} is missing`);
				}
				state.retained = notice;
			},
			runRetainedAction: () =>
				screen.act("invoke the outgoing notice action", () => {
					if (!state.retained?.action) {
						throw new Error("No notice action was retained");
					}
					state.retained.action.run();
				}),
			session: (name?: string) => {
				const current = session(state, name);
				return {
					callbacks: [...current.callbacks],
					calls: [...current.client.calls],
					finished: [...current.finished],
					nodes: current.registries.map((registry) => registry.getNodes().size),
					reads: current.client.reads.length,
					released: [...current.client.released],
					removals: [...current.client.removals.keys()],
					saves: [...current.client.saves.keys()],
				};
			},
			snapshot: () => {
				const container = view(state).container;
				return {
					fieldError: container.querySelector("form [role=alert]")?.textContent,
					loading: container.querySelector("[data-loading]")?.textContent,
					notices: [...container.querySelectorAll("article")].map((entry) => ({
						message: entry.querySelector("p")?.textContent,
						outcome: entry.querySelector("output")?.textContent,
						pending: entry.querySelector("button")?.disabled,
					})),
					queryError: container.querySelector("main > [role=alert]")?.textContent,
					rows: container.querySelector("[data-rows]")?.textContent,
					saving: container.querySelector<HTMLButtonElement>("form button")?.disabled,
					status: container.querySelector("form [role=status]")?.textContent,
					title: container.querySelector<HTMLInputElement>("input")?.value,
				};
			},
			submit: () => screen.act("save the note", () => submitForm(view(state).container)),
			type: (title: string) => screen.act(`type ${title}`, () => typeInput(view(state).container, "title", title)),
		}),
	),
);
export function notesFeature(options: { readonly uninterruptible?: boolean } = {}) {
	return feedback.trait("screen", "a signed-in notes feature with held RPC responses", function* ({ state, screen }) {
		state.current = generation("alice", options.uninterruptible ?? false);
		state.sessions.set("alice", state.current);
		state.view = yield* screen.open(<FeedbackView state={state.current} />);
	});
}
