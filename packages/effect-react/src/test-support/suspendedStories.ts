import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { ViewEditor } from "./draftFields.ts";
import { draftStorage } from "./draftStorage.ts";
import { typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { suspendedDraftView } from "./suspendedDraftView.tsx";

draftStorage();
interface State {
	view?: Awaited<ReturnType<typeof suspendedDraftView>>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("The suspended screen is not open");
	}
	return state.view;
}
export const suspended = storyKit(
	screenKit(
		"suspended draft screen",
		(): State => ({}),
		(state, screen) => ({
			draft: () => current(state),
			show: (session: string, suspend = false, transition = false, mode: "visible" | "hidden" = "visible") =>
				screen.act(`show ${session}, suspended ${suspend}, transition ${transition}, ${mode}`, () =>
					current(state).show(session, suspend, transition, mode),
				),
			staleEdit: (form: NonNullable<ViewEditor["form"]>, value: string) =>
				screen.act(`a stale form edits name: ${value}`, () => form.change("name", value)),
			type: (value: string) => screen.act(`type name: ${value}`, () => typeInput(current(state).container, "name", value)),
		}),
	),
);
export function suspendedDraft() {
	return suspended.trait("screen", "a draft inside Suspense and Activity", function* ({ screen, state }) {
		const view = yield* screen.open();
		state.view = yield* Effect.promise(() => suspendedDraftView(view));
	});
}
