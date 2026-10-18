import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { draftStorage } from "./draftStorage.ts";
import { persistedCreateView } from "./persistedCreateView.tsx";
import { screenKit } from "./screenKit.ts";

draftStorage();
interface State {
	complete: Deferred.Deferred<void>;
	view?: Awaited<ReturnType<typeof persistedCreateView>>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("The create screen is not open");
	}
	return state.view;
}
export const creates = storyKit(
	screenKit(
		"persisted create screen",
		(): State => ({ complete: Effect.runSync(Deferred.make<void>()) }),
		(state, screen) => ({
			create: () => current(state),
			finishSave: () => screen.act("the create responds", () => Effect.runPromise(Deferred.succeed(state.complete, undefined))),
			*reload() {
				screen.tell("reload the create screen with a fresh registry");
				yield* Effect.promise(current(state).unmount);
				const view = yield* screen.open();
				state.view = yield* Effect.promise(() => persistedCreateView(view));
			},
			show: (session: string) => screen.act(`show session ${session}`, () => current(state).show(session)),
			submit: () => screen.act("submit the create form", () => current(state).save()),
			type: (value: string) => screen.act(`type name: ${value}`, () => current(state).change(value)),
		}),
	),
);
export function persistedCreate(held = false, direct = false) {
	return creates.trait("screen", `a ${direct ? "direct" : "create"} persisted form`, function* ({ screen, state }) {
		const view = yield* screen.open();
		state.view = yield* Effect.promise(() =>
			persistedCreateView(view, (values) => (held ? Deferred.await(state.complete).pipe(Effect.as(values)) : Effect.succeed(values)), direct),
		);
	});
}
