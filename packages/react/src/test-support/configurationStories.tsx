import { Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ConfigurationView } from "./ConfigurationView.tsx";
import { type ConfigurationProps, type Current, firstRuntime, Name, NormalizedName, secondRuntime } from "./configurationModel.ts";
import { draftStorage } from "./draftStorage.ts";
import { clickButton, type Screen, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

draftStorage();

type Change = "inline callbacks" | "the schema" | "the runtime" | "removing the rejection mapper";

interface State {
	original?: Current["form"] | undefined;
	props: ConfigurationProps;
	view?: Rendered;
}

function view(state: State) {
	if (!state.view) {
		throw new Error("No configuration screen");
	}
	return state.view;
}

function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { container } = view(state);
		return settleScreen(container, () => container.querySelector('[data-saving="true"]') !== null, screen.tell);
	});
}

function configurationVerbs(state: State, screen: Screen) {
	return {
		reconfigure: (change: Change) =>
			screen.act(`rerender the form with ${change} changed`, async () => {
				state.props = {
					...state.props,
					fields: change === "the schema" ? NormalizedName : state.props.fields,
					mapping: change !== "removing the rejection mapper",
					revision: "after",
					runtime: change === "the runtime" ? secondRuntime : state.props.runtime,
				};
				await view(state).render(<ConfigurationView {...state.props} />);
			}),
		save: () => screen.act("save the draft", () => clickButton(view(state).container, "Save")),
		type: (value: string) => screen.act(`type ${JSON.stringify(value)}`, () => typeInput(view(state).container, "name", value)),
	};
}

export const configurations = storyKit(
	screenKit(
		"form configuration",
		(): State => ({
			props: {
				completion: Promise.withResolvers<void>(),
				fields: Name,
				held: {},
				kind: "create",
				mapping: true,
				now: () => 0,
				pending: false,
				rejected: false,
				revision: "before",
				runtime: firstRuntime,
				saved: [],
			},
		}),
		(state, screen) => ({
			...configurationVerbs(state, screen),
			fieldError: () => Effect.sync(() => JSON.parse(view(state).container.querySelector("output")?.textContent ?? "{}").error ?? "none"),
			finishSave: () => screen.act("the save responds", () => state.props.completion.resolve()).pipe(Effect.andThen(settle(state, screen))),
			form: () => Effect.sync(() => (state.props.held.current?.form === state.original ? "original form" : "replaced form")),
			input: () => Effect.sync(() => view(state).container.querySelector("input")?.value),
			revert: () => screen.act("revert the draft", () => clickButton(view(state).container, "Revert")),
			savedWith: () => Effect.sync(() => [...state.props.saved]),
			storedDraft: (revision: "before" | "after") =>
				Effect.sync(() => {
					const raw = window.localStorage.getItem(`${state.props.kind}-${revision}`);
					return raw === null ? "none" : JSON.parse(raw).values.name;
				}),
		}),
	),
);

interface Options {
	readonly kind: ConfigurationProps["kind"];
	readonly pending?: boolean;
	readonly rejected?: boolean;
}

function described({ kind, pending, rejected }: Options) {
	const save = rejected ? `a save the server rejects${pending ? " once it responds" : ""}` : "a save that records its runtime and values";
	return `a ${kind} form with ${save}`;
}

function* open({ now, screen, state }: { readonly now: () => number; readonly screen: Screen; readonly state: State }, options: Options) {
	state.props = { ...state.props, kind: options.kind, now, pending: options.pending ?? false, rejected: options.rejected ?? false };
	state.view = yield* screen.open(<ConfigurationView {...state.props} />);
	state.original = state.props.held.current?.form;
}

export function configuredForm(options: Options) {
	return configurations.trait("screen", described(options), (engine) => open(engine, options));
}

export function draftTypedThenReconfigured(kind: ConfigurationProps["kind"], change: Change, draft = "draft") {
	return configurations.trait(
		"screen",
		`${described({ kind })} holding the draft ${JSON.stringify(draft)}, rerendered with ${change} changed`,
		function* (engine) {
			yield* open(engine, { kind });
			const { reconfigure, type } = configurationVerbs(engine.state, engine.screen);
			yield* type(draft);
			yield* reconfigure(change);
		},
	);
}

export function rejectedSaveWaiting(kind: ConfigurationProps["kind"]) {
	const options = { kind, pending: true, rejected: true };
	return configurations.trait("screen", `${described(options)}, saved and waiting for the response`, function* (engine) {
		yield* open(engine, options);
		yield* configurationVerbs(engine.state, engine.screen).save();
	});
}
