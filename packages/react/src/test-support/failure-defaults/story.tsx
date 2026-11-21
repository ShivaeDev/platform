import { Deferred, Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Answer, failureClient, type Outage } from "#test/failure-defaults/client.ts";
import { FailureDefaultsView, type FailureScreen } from "#test/failure-defaults/view.tsx";
import { timesWords } from "#test/outcomeWords.ts";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";

interface State {
	current: FailureScreen;
	view?: Rendered;
}

type Control =
	| "Rename"
	| "Rename quietly"
	| "Rename with its own wording"
	| "Rename offline"
	| "Rename with a dying server"
	| "Rename with too much text"
	| "Rename with the server's words"
	| "Rename with a quiet handler"
	| "Rename during an outage"
	| "Rename with undo"
	| "Rename held by an outage"
	| "Hide drafts"
	| "Show drafts"
	| "Save form"
	| "Save with a dying server";

function container(state: State) {
	if (!state.view) {
		throw new Error("The failure screen is not open");
	}
	return state.view.container;
}

function busy(state: State) {
	const root = container(state);
	return root.querySelector('[data-pending="true"]') !== null || root.textContent?.includes("Loading") === true;
}

function texts(state: State, selector: string) {
	return [...container(state).querySelectorAll(selector)].map((element) => element.textContent ?? "");
}

const press = Effect.fn("FailureDefaults.press")(function* (state: State, screen: Screen, name: string) {
	yield* screen.driver(container(state)).click({ name, role: "button" });
	yield* settleScreen(container(state), () => busy(state), screen.tell);
});

export const failures = storyKit(
	screenKit(
		"failure defaults",
		(): State => ({ current: { client: failureClient(), queryDefaults: false, rechecks: 0 } }),
		(state, screen) => ({
			// The second read waits until the server answers, so the screen can be read while it loads.
			answerReread: () =>
				Effect.gen(function* () {
					yield* screen.act("the server answers the second read with Quarterly report", () =>
						Deferred.doneUnsafe(state.current.client.server.reread, Effect.void),
					);
					yield* settleScreen(container(state), () => busy(state), screen.tell);
				}),
			fieldError: () => Effect.sync(() => texts(state, "[data-field-error]")[0]),
			note: () => Effect.sync(() => texts(state, "[data-note], [role='alert']:not([data-notice]), [role='status']:not([data-notice])")),
			// A notice's own paragraph holds its words; the buttons beside it are the host's.
			notices: () => Effect.sync(() => texts(state, "[data-notice] > p")),
			outageAnswersHeldRename: () =>
				Effect.gen(function* () {
					yield* screen.act("the server answers the held rename with ServiceUnavailable", () =>
						Deferred.doneUnsafe(state.current.client.server.heldOutage, Effect.void),
					);
					yield* settleScreen(container(state), () => busy(state), screen.tell);
				}),
			outageEnds: () =>
				Effect.sync(() => {
					screen.tell("the outage is over");
					state.current.client.server.outage = "over";
				}),
			outageIs: (outage: Outage) =>
				Effect.sync(() => {
					screen.tell(`the server is out with ${outage}`);
					state.current.client.server.outage = outage;
				}),
			press: (control: Control) => press(state, screen, control),
			rechecks: () => Effect.sync(() => timesWords(state.current.rechecks)),
			retry: () => screen.driver(container(state)).click({ name: "Retry", role: "button" }),
			serverAnswers: (answer: Answer) =>
				Effect.sync(() => {
					screen.tell(`the server answers renames with ${answer}`);
					state.current.client.server.answer = answer;
				}),
		}),
	),
);

type Options = Partial<Pick<FailureScreen, "hostWording" | "queryDefaults">>;

export function failureScreen(options: Options = {}, words = "with the default failure host") {
	return failures.trait("screen", `alice opened the draft screen ${words}`, function* ({ screen, state }) {
		state.current = { ...state.current, ...options };
		state.view = yield* screen.open(<FailureDefaultsView state={state.current} />);
		yield* settleScreen(container(state), () => busy(state), screen.tell);
	});
}
