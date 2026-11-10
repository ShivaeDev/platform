import { type Cause, Deferred, Effect, Fiber, Queue, Stream } from "effect";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";

expectNoReactWarnings();

export const answerScreen = storyKit({
	clock: "test",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const updates = yield* Queue.unbounded<number, Cause.Done>();
		const listening = yield* Deferred.make<void>();
		let current = 0;
		const answers = {
			answered: Stream.unwrap(Deferred.succeed(listening, undefined).pipe(Effect.as(Stream.fromQueue(updates)))),
			current: Effect.sync(() => current),
			name: "the page",
		};
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement("main"))),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return {
			answers,
			deliverAnswer: () => {
				current += 1;
				return Queue.offer(updates, current);
			},
			listening,
			updates,
			view,
		};
	},
	name: "live answer screen",
	stages: [],
	verbs: ({ answers, deliverAnswer, listening, updates, view }, story) => {
		const driver = screenDriver({ act, root: view.container, tell: story.tell });
		return {
			deliverAnswer: () => {
				story.tell("the page receives a live answer");
				return deliverAnswer();
			},
			endAnswers: () => {
				story.tell("the page's answers end");
				return Queue.end(updates);
			},
			repeatAnswerCount: () => {
				story.tell("the page reports its answer count again without a new answer");
				return answers.current.pipe(Effect.flatMap((count) => Queue.offer(updates, count)));
			},
			startWaiting: () =>
				Effect.gen(function* () {
					const fiber = yield* driver.withLiveAnswer(answers, Effect.void).pipe(
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
