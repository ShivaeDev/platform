import { Deferred, Effect } from "effect";
import { TestClock } from "effect/testing";
import type { vi } from "vitest";
import type { BrowserDraftConfig } from "@shivaedev/form/client/react.ts";
import type { Row, Save, ViewEditor } from "./draftFields.ts";
import { persistedDraftView } from "./persistedDraftView.tsx";
import { clickButton, type Screen } from "./Screen.ts";
import { settleScreen } from "./settleScreen.ts";

export type Field = "name" | "quantity";
export type SaveMode = "immediate" | "held" | "rejected";
export type Config = Omit<BrowserDraftConfig, "now">;

const remote: Row = { name: "Remote", quantity: "350" };

export interface State {
	readonly complete: Deferred.Deferred<void>;
	config: Config;
	firstForm?: NonNullable<ViewEditor["form"]>;
	holding: boolean;
	save: SaveMode;
	storage?: ReturnType<typeof vi.fn>;
	view?: Awaited<ReturnType<typeof persistedDraftView>>;
}

export function current(state: State) {
	if (!state.view) {
		throw new Error("The draft screen is not open");
	}
	return state.view;
}

function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { container } = current(state);
		return settleScreen(container, () => !state.holding && container.querySelector('[data-saving="true"]') !== null, screen.tell);
	});
}

function saveRow(state: State): Save {
	return (values) => {
		const row = { ...values, quantity: String(values.quantity) };
		if (state.save === "rejected") {
			return Effect.fail("Rejected");
		}
		if (state.save === "held") {
			return Deferred.await(state.complete).pipe(Effect.as(row));
		}
		return Effect.succeed(row);
	};
}

export function draftVerbs(state: State, screen: Screen, now: () => number) {
	function mount(line: string, session = "first", config: Config = state.config) {
		return Effect.gen(function* () {
			screen.tell(line);
			if (state.view) {
				yield* Effect.promise(state.view.unmount);
			}
			const view = yield* screen.open();
			state.config = config;
			state.view = yield* Effect.promise(() => persistedDraftView(view, { ...config, now }, saveRow(state), session));
			state.firstForm ??= state.view.editor().form;
		});
	}
	return {
		activity: (mode: "visible" | "hidden") => screen.act(`Activity becomes ${mode}`, () => current(state).activity(mode)),
		ageBy: (ms: number) => Effect.sync(() => screen.tell(`the stored draft ages by ${ms} milliseconds`)).pipe(Effect.andThen(TestClock.adjust(ms))),
		finishSave: () =>
			screen
				.act("the save responds", () => {
					state.holding = false;
					return Effect.runPromise(Deferred.succeed(state.complete, undefined));
				})
				.pipe(Effect.andThen(settle(state, screen))),
		firstFormEdits: (value: string) =>
			screen.act(`the first session's form edits the name to ${JSON.stringify(value)}`, () => state.firstForm?.change("name", value)),
		hideForm: () => screen.act("hide the form in the first session", () => current(state).show("first", false)),
		open: (session = "first") => mount(`open the draft editor in the ${session} session`, session),
		refresh: () => screen.act("the query refreshes to Remote / 350", () => current(state).refresh(remote)),
		reload: (config?: Config) =>
			mount(
				config ? `reload the editor with a ${config.maxBytes}-byte draft limit` : "reload the editor in a fresh root and registry",
				"first",
				config,
			),
		revert: () => screen.act("revert the draft", () => clickButton(current(state).container, "Revert")),
		session: (session: string | undefined, visible = true) =>
			screen.act(
				session ? `${visible ? "show" : "replace the session with"} the ${session} session${visible ? "" : " while the form is hidden"}` : "sign out",
				() => current(state).show(session, visible),
			),
		submit: () =>
			screen
				.act("save the draft", () => {
					state.holding = state.save === "held";
					return current(state).save();
				})
				.pipe(Effect.andThen(settle(state, screen))),
		type: (name: Field, value: string) =>
			screen.act(`type ${name}: ${JSON.stringify(value.length > 40 ? `${value.slice(0, 8)}… (${value.length} characters)` : value)}`, () =>
				current(state).change(name, value),
			),
	};
}

export function fields(state: State) {
	function input(name: Field) {
		return current(state).container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? "missing";
	}
	return { name: input("name"), quantity: input("quantity") };
}
