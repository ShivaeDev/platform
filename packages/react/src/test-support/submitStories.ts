import { Effect } from "effect";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { CreateSubmitView, EditorSubmitView, type SubmitState } from "#test/submitViews.tsx";

type Control = "Form submit" | "Atom submit" | "Save";

interface State extends SubmitState {
	view?: Rendered;
}

function current(state: State) {
	if (!state.view) {
		throw new Error("No submission screen");
	}
	return state.view;
}

function shown(state: State): { readonly created?: unknown; readonly dirty?: boolean; readonly values: { readonly name: string } } {
	return JSON.parse(current(state).container.querySelector("output")?.textContent ?? "null");
}

function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { container } = current(state);
		return settleScreen(
			container,
			() => container.querySelector("output") === null || container.querySelector('[data-saving="true"]') !== null,
			screen.tell,
		);
	});
}

function submitVerbs(state: State, screen: Screen) {
	return {
		submit: (control: Control) =>
			screen
				.driver(current(state).container)
				.click({ name: control, role: "button" })
				.pipe(Effect.andThen(settle(state, screen))),
		type: (value: string) => screen.driver(current(state).container).enter('input[name="name"]', value),
	};
}

export const submissions = storyKit(
	screenKit(
		"form submission screen",
		(): State => ({ decoding: Promise.withResolvers<void>(), names: [] }),
		(state, screen) => ({
			...submitVerbs(state, screen),
			created: () => Effect.sync(() => shown(state).created ?? "none"),
			dirty: () => Effect.sync(() => (shown(state).dirty ? "dirty" : "clean")),
			fieldError: () => Effect.sync(() => current(state).container.querySelector('[role="alert"]')?.textContent ?? "none"),
			finishDecode: () =>
				screen.act("the asynchronous Schema decoder finishes", () => state.decoding.resolve()).pipe(Effect.andThen(settle(state, screen))),
			formName: () => Effect.sync(() => shown(state).values.name),
			submittedNames: () => Effect.sync(() => [...state.names]),
		}),
	),
);

type Kind = "create" | "slow" | "editor" | "rejected";

const described: Record<Kind, string> = {
	create: "a create form that trims the name it creates",
	editor: "an editor for desk lamps whose save upper-cases the name",
	rejected: "a create form whose server rejects the name Taken",
	slow: "a create form whose Schema decodes the name asynchronously",
};

function* open({ screen, state }: { readonly screen: Screen; readonly state: State }, kind: Kind) {
	state.view = yield* screen.open(
		kind === "editor"
			? createElement(EditorSubmitView)
			: createElement(CreateSubmitView, { rejected: kind === "rejected", slow: kind === "slow", state }),
	);
	yield* settle(state, screen);
}

export function submissionForm(kind: Kind = "create") {
	return submissions.trait("screen", described[kind], (engine) => open(engine, kind));
}

export function createdOnce() {
	return submissions.trait("screen", `${described.create} created "Desk lamps " through Form submit`, function* (engine) {
		yield* open(engine, "create");
		const { submit, type } = submitVerbs(engine.state, engine.screen);
		yield* type("Desk lamps ");
		yield* submit("Form submit");
	});
}

export function savedThenTyped(name: string) {
	return submissions.trait("screen", `${described.create} saved Desk lamps through Save, and ${name} was typed next`, function* (engine) {
		yield* open(engine, "create");
		const { submit, type } = submitVerbs(engine.state, engine.screen);
		yield* type("Desk lamps");
		yield* submit("Save");
		yield* type(name);
	});
}

export function slowDecodeWithNewerInput() {
	return submissions.trait("screen", `${described.slow} is decoding Desk lamps while Desk lamps and chairs was typed`, function* (engine) {
		yield* open(engine, "slow");
		const { type } = submitVerbs(engine.state, engine.screen);
		yield* type("Desk lamps");
		yield* engine.screen.driver(current(engine.state).container).click({ name: "Save", role: "button" });
		yield* type("Desk lamps and chairs");
	});
}

export function takenRejected() {
	return submissions.trait("screen", `${described.rejected} rejected Taken`, function* (engine) {
		yield* open(engine, "rejected");
		const { submit, type } = submitVerbs(engine.state, engine.screen);
		yield* type("Taken");
		yield* submit("Form submit");
	});
}
