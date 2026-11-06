import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { until } from "@shivaedev/test-story/server/until.ts";
import { openScreen } from "./openScreen.ts";
import type { Engine } from "./story.ts";

export function independentVerbs(engine: Engine) {
	return {
		allowRead: () =>
			Effect.sync(() => {
				engine.host.control.allowed = true;
			}),
		independentShows: (title: string) =>
			Effect.promise(() =>
				act(async () => {
					const screen = engine.other.screen;
					if (screen === undefined) {
						throw new Error("Open the independent screen first");
					}
					await Effect.runPromise(
						until(
							AtomRegistry.toStreamResult(screen.registry, engine.client.api.independent.query()),
							(rows) => rows.some((note) => note.title === title),
							{ name: "independent subscription result" },
						),
					);
				}),
			),
		openIndependent: () =>
			Effect.gen(function* () {
				const screen = yield* Effect.acquireRelease(
					Effect.promise(() => openScreen(engine.client, "independent")),
					(view) => Effect.promise(view.unmount),
				);
				engine.other.screen = screen;
				yield* Effect.promise(() =>
					act(async () => void (await Effect.runPromise(AtomRegistry.getResult(screen.registry, engine.client.api.independent.query())))),
				);
			}),
	};
}
