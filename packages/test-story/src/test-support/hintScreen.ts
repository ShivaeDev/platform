import { type Cause, Deferred, Effect, Fiber, Queue, Stream } from "effect";
import { act, createElement } from "react";
import type { ClientActivityState } from "@shivaedev/contract/clientActivity.ts";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";

expectNoReactWarnings();

export const hintScreen = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const updates = yield* Queue.unbounded<ClientActivityState, Cause.Done>();
		const listening = yield* Deferred.make<void>();
		let current: ClientActivityState = { liveHints: 0, liveInvalidations: 0, refreshingAtoms: 0, rpcCalls: 0 };
		const pending = Object.assign(Stream.unwrap(Deferred.succeed(listening, undefined).pipe(Effect.as(Stream.fromQueue(updates)))), {
			current: Effect.sync(() => current),
		});
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement("main"))),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return {
			deliverHint: () => {
				current = { ...current, liveHints: current.liveHints + 1 };
				return Queue.offer(updates, current);
			},
			listening,
			pending,
			updates,
			view,
		};
	},
	name: "live hint screen",
	stages: [],
	verbs: ({ deliverHint, listening, pending, updates, view }, story) => {
		const driver = screenDriver({ act, pending, root: view.container, tell: story.tell });
		return {
			deliverHint: () => {
				story.tell("the client receives a live hint");
				return deliverHint();
			},
			endActivity: () => {
				story.tell("the client activity stream ends");
				return Queue.end(updates);
			},
			reportIdle: () => {
				story.tell("the client reports idle without a new hint");
				return pending.current.pipe(Effect.flatMap((state) => Queue.offer(updates, state)));
			},
			startWaiting: () =>
				Effect.gen(function* () {
					const fiber = yield* driver.nextLiveHint().pipe(
						Effect.as("received"),
						Effect.catchTag("SignalNotReceived", (error) => Effect.succeed(error.message)),
						Effect.forkScoped({ startImmediately: true }),
					);
					yield* Deferred.await(listening);
					return { finish: Fiber.join(fiber), state: Effect.sync(() => (fiber.pollUnsafe() === undefined ? "waiting" : "settled")) };
				}),
		};
	},
});
