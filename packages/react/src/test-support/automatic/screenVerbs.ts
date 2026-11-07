import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import { until } from "@shivaedev/test-story/server/until.ts";
import { type Engine, live } from "#test/automatic/engine.ts";
import { automaticVerbs } from "#test/automatic/verbs.ts";

export function screenVerbs(engine: Engine, story: { tell: (line: string) => void }) {
	engine.narrator.tell = story.tell;
	const verbs = automaticVerbs(engine);
	return {
		...verbs,
		closeFirstScreen: () => {
			story.tell("close the first screen and its registry");
			return Effect.promise(engine.screen.closePrimary);
		},
		connection: () => Effect.sync(() => engine.screen.container.querySelector('[role="status"]')?.textContent),
		notifications: () => engine.delivered,
		notifiedKeys: () => Effect.map(engine.delivered, (notifications) => notifications.flat()),
		openSeparateScreen: () => {
			story.tell("open another screen for note 2 in an independent registry");
			return Effect.promise(engine.screen.openSeparate).pipe(Effect.andThen(verbs.settle(engine.screen.separateContainer)));
		},
		publications: () => Effect.sync(() => [...engine.host.publications]),
		queryValue: (id: number) => Effect.sync(() => (engine.screen.query(id) === engine.marked.get(id) ? "the same value" : "a new value")),
		reads: () => Effect.sync(() => engine.host.reads.toSorted()),
		reconnected: () => {
			story.tell("the client's retry interval passes and its socket reconnects");
			return Effect.gen(function* () {
				const run = Effect.runPromiseWith(yield* Effect.context());
				yield* Effect.promise(() => engine.screen.reconnected);
				yield* until(engine.clock.sleeps, (interval) => Duration.toMillis(interval) > 20, {
					name: "the live subscription's retry timer",
				});
				yield* Effect.promise(() => act(async () => run(TestClock.adjust("2 seconds"))));
				yield* live(engine);
			});
		},
		renameFromScreen: (title: string) => {
			story.tell(`rename note 1 to ${title} from the screen`);
			const read = engine.screen.nextResult(1);
			return Effect.promise(() => engine.screen.rename(title)).pipe(
				Effect.andThen(Effect.promise(() => act(() => read))),
				Effect.andThen(verbs.settle()),
			);
		},
		requests: () => Effect.sync(() => [...engine.host.requests]),
		separateRenamed: (title: string) => verbs.anotherHostRenamesShown(2, title, engine.screen.separateContainer),
		separateShown: () => Effect.sync(() => engine.screen.separateContainer().textContent),
		shown: (id: number) => Effect.sync(() => engine.screen.container.querySelector(`[data-note="${id}"]`)?.textContent),
		sockets: () =>
			Effect.sync(() => engine.screen.addresses.map((address) => (address === engine.host.url.replace(/^http/u, "ws") ? "tab socket" : address))),
	};
}
