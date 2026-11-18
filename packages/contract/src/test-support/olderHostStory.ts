import { Effect, Queue } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { shown } from "#test/answers.ts";
import { commandFlights } from "#test/commandFlights.ts";
import { type OlderHostEngine, olderHostEngine } from "#test/older-host/engine.ts";
import { settled } from "#test/settled.ts";

function connected(engine: OlderHostEngine) {
	const current = engine.connection.current;
	if (current === undefined) {
		throw new Error("Connect the tab first");
	}
	return current;
}

export const olderHostStory = storyKit({
	clock: "test",
	create: () => olderHostEngine,
	inspect: ({ counter, syncIds }) => ({ ...counter, syncIds }),
	name: "commands against a host that does not confirm sync tokens",
	stages: ["connection"],
	verbs: (engine, story) => {
		function flights() {
			const { activity, run } = connected(engine);
			return commandFlights({ activity, flight: engine.flight, run, states: engine.states }, story.tell);
		}
		return {
			add: (amount: number) => flights().complete(`the tab adds ${amount}`, connected(engine).tab.api.add.run({ amount })),
			beginAdd: (amount: number) => flights().begin(`the tab starts adding ${amount}`, connected(engine).tab.api.add.run({ amount })),
			finished: () => flights().finished(),
			hostAnswers: () =>
				Effect.gen(function* () {
					story.tell("the host sends the counter's value on the open stream");
					const { view } = connected(engine);
					yield* Queue.offer(engine.frames, { _tag: "Result", query: "value", queryIndex: 0, value: engine.counter.value });
					yield* settled(engine.registry, view);
				}),
			hostStartsSyncing: () => {
				story.tell("the host says the open stream confirms sync tokens from here");
				return Queue.offer(engine.frames, { _tag: "Syncing" });
			},
			openView: () =>
				Effect.suspend(() => {
					story.tell("the tab opens the counter and the host receives its stream request");
					engine.registry.mount(connected(engine).view);
					return Queue.take(engine.subscribed);
				}),
			shown: () => Effect.sync(() => shown(engine.registry.get(connected(engine).view), (value) => `counter: ${value}`)),
			signals: () => flights().signals(),
			syncIdsOnCommands: () => Effect.sync(() => [...engine.syncIds]),
			untilAccepted: () => flights().untilAccepted(),
		};
	},
});

export function overTheSharedSocket() {
	return olderHostStory.trait("connection", "the tab uses the default shared socket", (engine) => {
		engine.connection.current = engine.connect(false);
	});
}

export function overCustomProtocol() {
	return olderHostStory.trait("connection", "the tab uses a protocol supplied by the app", (engine) => {
		engine.connection.current = engine.connect(true);
	});
}
