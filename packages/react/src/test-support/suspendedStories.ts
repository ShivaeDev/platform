import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { ViewEditor } from "./draftFields.ts";
import { draftStorage } from "./draftStorage.ts";
import { type Screen, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { suspendedDraftView } from "./suspendedDraftView.tsx";

draftStorage();

interface State {
	firstForm?: NonNullable<ViewEditor["form"]>;
	view?: Awaited<ReturnType<typeof suspendedDraftView>>;
}

function current(state: State) {
	if (!state.view) {
		throw new Error("The suspended screen is not open");
	}
	return state.view;
}

function suspendedVerbs(state: State, screen: Screen) {
	return {
		firstFormEdits: (value: string) =>
			screen.act(`the first session's form edits the name to ${JSON.stringify(value)}`, () => state.firstForm?.change("name", value)),
		hiddenSession: (session: string) =>
			screen.act(`render the ${session} session inside hidden Activity`, () => current(state).show(session, false, false, "hidden")),
		session: (session: string) => screen.act(`show the ${session} session`, () => current(state).show(session)),
		suspendingTransition: (session: string) =>
			screen.act(`start a transition to the ${session} session that suspends`, () => current(state).show(session, true, true)),
		type: (value: string) => screen.act(`type name: ${JSON.stringify(value)}`, () => typeInput(current(state).container, "name", value)),
	};
}

export const suspended = storyKit(
	screenKit(
		"suspended draft screen",
		(): State => ({}),
		(state, screen) => ({
			...suspendedVerbs(state, screen),
			firstSessionForm: () => Effect.sync(() => (current(state).editor("first").form === state.firstForm ? "same form" : "replaced form")),
			loading: () => Effect.sync(() => (current(state).container.textContent?.includes("Loading") ? "shown" : "not shown")),
			name: () => Effect.sync(() => current(state).container.querySelector<HTMLInputElement>('input[name="name"]')?.value),
			stored: () =>
				Effect.sync(() => {
					const raw = window.localStorage.getItem("transition-draft");
					return raw === null ? "none" : JSON.parse(raw).values.name;
				}),
			suspensions: () => Effect.sync(() => (current(state).attempts.length > 0 ? "suspended" : "never suspended")),
		}),
	),
);

type Step = "typed" | "transition canceled" | "returned" | "continued" | "second typed" | "hidden" | "replaced while hidden" | "revealed";

const described: Record<Step, string> = {
	continued: "the first session continuing to Continued editing after a canceled suspending transition",
	hidden: "the first session's draft Visible draft rendered inside hidden Activity",
	"replaced while hidden": "the first session's draft Visible draft replaced by the second session inside hidden Activity",
	returned: "the first session shown again after its suspending transition to the second session was canceled",
	revealed: "the second session revealed after replacing the first session inside hidden Activity",
	"second typed": "the second session typing New session after the first session's canceled suspending transition",
	"transition canceled": "the first session's draft Visible draft still shown while a transition to the second session suspends",
	typed: "the first session typing Visible draft inside Suspense and Activity",
};

const order: readonly Step[] = ["typed", "transition canceled", "returned", "continued", "second typed"];
const hiddenOrder: readonly Step[] = ["typed", "hidden", "replaced while hidden", "revealed"];

export function suspendedDraft(step: Step = "typed") {
	return suspended.trait("screen", described[step], function* ({ now, screen, state }) {
		const view = yield* screen.open();
		state.view = yield* Effect.promise(() => suspendedDraftView(view, now));
		state.firstForm = state.view.editor().form;
		const verbs = suspendedVerbs(state, screen);
		const steps = order.includes(step) ? order : hiddenOrder;
		const run: Record<Step, Effect.Effect<void>> = {
			continued: verbs.type("Continued editing"),
			hidden: verbs.hiddenSession("first"),
			"replaced while hidden": verbs.hiddenSession("second"),
			returned: verbs.session("first"),
			revealed: verbs.session("second"),
			"second typed": Effect.andThen(verbs.session("second"), verbs.type("New session")),
			"transition canceled": verbs.suspendingTransition("second"),
			typed: verbs.type("Visible draft"),
		};
		for (const next of steps.slice(0, steps.indexOf(step) + 1)) {
			yield* run[next];
		}
	});
}
