import { Effect, Queue, Scheduler, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { LiveHint } from "#live.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { hintWords, times } from "./answers.ts";
import { notes } from "./notes.ts";

const scheduledHintsEngine = Effect.gen(function* () {
	const scheduler = yield* Scheduler.Scheduler;
	const reactivity = yield* Reactivity.Reactivity;
	const tasks: Array<() => void> = [];
	const dispatcher: Scheduler.SchedulerDispatcher = {
		flush: () => {
			for (const task of tasks.splice(0)) {
				task();
			}
		},
		scheduleTask: (task) => tasks.push(task),
	};
	const server = yield* makeLiveServer.pipe(
		Effect.provideService(Scheduler.Scheduler, {
			executionMode: scheduler.executionMode,
			makeDispatcher: () => dispatcher,
			shouldYield: (fiber) => scheduler.shouldYield(fiber),
		}),
	);
	const hints = yield* Queue.unbounded<LiveHint>();
	yield* server.stream([notes.item(1), notes.item(2)]).pipe(
		Stream.runForEach((hint) => Queue.offer(hints, hint)),
		Effect.forkScoped,
	);
	yield* Queue.take(hints);
	return { dispatcher, hints, reactivity, tasks };
});

export const scheduledHints = storyKit({
	create: () => scheduledHintsEngine,
	layer: Reactivity.layer,
	name: "runtime-scheduled live hints",
	stages: [],
	verbs: ({ dispatcher, hints, reactivity, tasks }, story) => ({
		change: (id: number) => {
			story.tell(`note ${id} changes while the runtime scheduler holds dispatch`);
			return reactivity.invalidate(invalidationKeys([notes.item(id)]));
		},
		dispatch: () => {
			story.tell("the runtime scheduler dispatches its pending work");
			return Effect.sync(() => dispatcher.flush());
		},
		nextHint: () => Effect.map(Queue.take(hints), hintWords),
		scheduledBatches: () => Effect.sync(() => `scheduled ${times(tasks.length)}`),
	}),
});
