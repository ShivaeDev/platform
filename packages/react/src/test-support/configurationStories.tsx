import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { ConfigurationView } from "./ConfigurationView.tsx";
import { type ConfigurationProps, firstRuntime, Name, NormalizedName, secondRuntime } from "./configurationModel.ts";
import { draftStorage } from "./draftStorage.ts";
import { clickButton, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

draftStorage();
interface State {
	props: ConfigurationProps;
	view?: Rendered;
}
function view(state: State) {
	if (!state.view) {
		throw new Error("No configuration screen");
	}
	return state.view;
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
				pending: false,
				rejected: false,
				revision: "before",
				runtime: firstRuntime,
				saved: [],
			},
		}),
		(state, screen) => ({
			finishSave: () => screen.act("the save responds", () => state.props.completion.resolve()),
			form: () => state.props.held.current?.form,
			input: () => view(state).container.querySelector("input")?.value,
			output: () => JSON.parse(view(state).container.querySelector("output")?.textContent ?? "null"),
			reconfigure: (change: "callbacks" | "schema" | "runtime" | "automatic") =>
				screen.act(`change ${change}`, async () => {
					state.props = {
						...state.props,
						fields: change === "schema" ? NormalizedName : state.props.fields,
						mapping: change !== "automatic",
						revision: "after",
						runtime: change === "runtime" ? secondRuntime : state.props.runtime,
					};
					await view(state).render(<ConfigurationView {...state.props} />);
				}),
			revert: () => screen.act("revert the draft", () => clickButton(view(state).container, "Revert")),
			saved: () => state.props.saved,
			submit: () => screen.act("save the draft", () => clickButton(view(state).container, "Save")),
			type: (value: string) => screen.act(`type ${value}`, () => typeInput(view(state).container, "name", value)),
		}),
	),
);
export function configuredForm(kind: ConfigurationProps["kind"], rejected = false, pending = false) {
	return configurations.trait("screen", `a ${kind} form`, function* ({ screen, state }) {
		state.props = { ...state.props, kind, pending, rejected };
		state.view = yield* screen.open(<ConfigurationView {...state.props} />);
	});
}
