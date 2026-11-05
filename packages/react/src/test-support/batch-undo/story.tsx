import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { makeClient } from "./client.ts";
import { database, hasPostgres } from "./database.ts";
import { type Props, View } from "./View.tsx";

export const batchUndoStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(value) => Effect.sync(() => value.dispose()),
		);
		const client = yield* makeClient;
		const screen = new Screen(() => undefined);
		const view = yield* screen.open();
		const props: Omit<Props, "scale"> = { client, registry, update: { block: Effect.succeed(() => undefined) } };
		return { props, screen, state: { scale: 0.5 }, view };
	},
	inspect: ({ screen }) => screen.inspect(),
	layer: database,
	name: "batch Undo in React with PostgreSQL version guards",
	runIf: hasPostgres,
	stages: ["portions"],
	verbs: ({ props, screen, state, view }, story) => {
		screen.tell = story.tell;
		function settle() {
			return settleScreen(view.container, () => view.container.querySelector('[data-loading="true"]') !== null, story.tell);
		}
		function click(name: string) {
			return screen.driver(view.container).click({ name, role: "button" }).pipe(Effect.andThen(settle()));
		}
		function shown(selector: string) {
			return Effect.sync(() => view.container.querySelector(selector)?.textContent ?? "");
		}
		return {
			copy: () => click("Scale and copy"),
			edit: (id: string) => click(`Edit ${id}`),
			failure: () => shown("[data-failure]"),
			notice: () => shown("[data-notice]"),
			open: () => screen.act("open the batch editor", () => view.render(<View {...props} scale={state.scale} />)).pipe(Effect.andThen(settle())),
			refresh: () => click("Refresh rows"),
			rows: () => shown("[data-rows]"),
			scale: () => click("Scale portions"),
			undo: () => click("Undo"),
		};
	},
});

export function portionsScaledBy(scale: number) {
	return batchUndoStory.trait("portions", `the batch scales portions by ${scale}`, ({ state }) =>
		Effect.sync(() => {
			state.scale = scale;
		}),
	);
}
