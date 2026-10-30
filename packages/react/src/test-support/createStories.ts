import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { draftStorage } from "./draftStorage.ts";
import { persistedCreateView } from "./persistedCreateView.tsx";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

draftStorage();

type Form = "create adapter" | "direct hook";

interface State {
	readonly complete: Deferred.Deferred<void>;
	form: Form;
	holding: boolean;
	view?: Awaited<ReturnType<typeof persistedCreateView>>;
}

function current(state: State) {
	if (!state.view) {
		throw new Error("The create screen is not open");
	}
	return state.view;
}

function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { container } = current(state);
		return settleScreen(container, () => !state.holding && container.querySelector('[data-saving="true"]') !== null, screen.tell);
	});
}

function key(state: State) {
	return state.form === "direct hook" ? "direct-draft" : "create-draft";
}

function createVerbs(state: State, screen: Screen, now: () => number, held = false) {
	function create(values: { readonly name: string; readonly quantity: number }) {
		return held ? Deferred.await(state.complete).pipe(Effect.as(values)) : Effect.succeed(values);
	}
	return {
		finishSave: () =>
			screen
				.act("the create responds", () => {
					state.holding = false;
					return Effect.runPromise(Deferred.succeed(state.complete, undefined));
				})
				.pipe(Effect.andThen(settle(state, screen))),
		open: () =>
			Effect.gen(function* () {
				const view = yield* screen.open();
				state.view = yield* Effect.promise(() => persistedCreateView(view, now, create, state.form === "direct hook"));
			}),
		reload: () =>
			Effect.gen(function* () {
				screen.tell("reload the create form in a fresh root and registry");
				yield* Effect.promise(current(state).unmount);
				const view = yield* screen.open();
				state.view = yield* Effect.promise(() => persistedCreateView(view, now, create, state.form === "direct hook"));
			}),
		session: (session: string) => screen.act(`show the ${session} session`, () => current(state).show(session)),
		submit: () =>
			screen
				.act("submit the create form", () => {
					state.holding = held;
					return current(state).save();
				})
				.pipe(Effect.andThen(settle(state, screen))),
		type: (value: string) => screen.act(`type name: ${JSON.stringify(value)}`, () => current(state).change(value)),
	};
}

export const creates = storyKit(
	screenKit(
		"persisted create screen",
		(): State => ({ complete: Deferred.makeUnsafe<void>(), form: "create adapter", holding: false }),
		(state, screen, now) => ({
			...createVerbs(state, screen, now),
			name: () => Effect.sync(() => current(state).container.querySelector<HTMLInputElement>('input[name="name"]')?.value),
			stored: () =>
				Effect.sync(() => {
					const raw = window.localStorage.getItem(key(state));
					return raw === null ? "none" : JSON.parse(raw).values.name;
				}),
		}),
	),
);

export function createTyped(name: string, form: Form = "create adapter") {
	return creates.trait("screen", `a persisted ${form} form on Paper with the name ${name} typed`, function* ({ now, screen, state }) {
		state.form = form;
		const { open, type } = createVerbs(state, screen, now);
		yield* open();
		yield* type(name);
	});
}

export function createRestored() {
	return creates.trait("screen", "a persisted create form whose draft New order a reload restored", function* ({ now, screen, state }) {
		const { open, reload, type } = createVerbs(state, screen, now);
		yield* open();
		yield* type("New order");
		yield* reload();
	});
}

export function createHeldWithLaterEdit() {
	return creates.trait(
		"screen",
		"a persisted create form with a held create of Submitted and the later edit Later edit",
		function* ({ now, screen, state }) {
			const { open, submit, type } = createVerbs(state, screen, now, true);
			yield* open();
			yield* type("Submitted");
			yield* submit();
			yield* type("Later edit");
		},
	);
}
