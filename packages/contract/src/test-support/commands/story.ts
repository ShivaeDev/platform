import { Effect, Fiber, Queue, Result, Schema, Stream } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { isClientSettled } from "#clientActivity.ts";
import { commandEngine } from "./engine.ts";

export const commands = storyKit({
	clock: "test",
	create: () => commandEngine,
	inspect: ({ host }) => host.state,
	name: "commands across reconnect",
	stages: ["connection"],
	verbs: (engine, story) => ({
		add: (amount: number) =>
			Effect.gen(function* () {
				story.tell(`the client adds ${amount}`);
				const { client, run } = engine.connection();
				engine.state.command = yield* run(client.api.add.run({ amount })).pipe(Effect.forkScoped);
			}),
		answer: () =>
			Effect.gen(function* () {
				const fiber = engine.state.command;
				if (fiber === undefined) {
					return yield* Effect.die("Issue a command first");
				}
				const result = yield* Fiber.join(fiber).pipe(Effect.result);
				if (Result.isSuccess(result)) {
					return `counter: ${result.success}`;
				}
				if (!Schema.is(RpcClientError)(result.failure)) {
					return yield* Effect.fail(result.failure);
				}
				return `${result.failure._tag}: ${result.failure.reason._tag}${result.failure.reason._tag === "SocketOpenError" ? ` ${result.failure.reason.kind}` : ""}`;
			}),
		cancel: () =>
			Effect.gen(function* () {
				story.tell("the caller interrupts the held command");
				const fiber = engine.state.command;
				if (fiber === undefined) {
					return yield* Effect.die("Issue a command first");
				}
				yield* Fiber.interrupt(fiber);
				yield* until(engine.connection().activity, (state) => state.connectionStatus !== "waiting-for-connection" && isClientSettled(state), {
					name: "cancelled command released",
				});
			}),
		drop: () =>
			Effect.gen(function* () {
				story.tell("the socket drops and the server holds the next handshake");
				yield* engine.host.drop;
				yield* Queue.take(engine.events);
			}),
		executed: () => Effect.map(Queue.take(engine.host.executed), (value) => `counter: ${value}`),
		holdResponse: () => {
			story.tell("the server holds the next command response");
			engine.host.state.holdResponse = true;
		},
		opened: () => Effect.sync(() => `${engine.host.state.handshakes} socket handshakes`),
		pass: (milliseconds: number) => {
			story.tell(`${milliseconds} milliseconds pass`);
			return TestClock.adjust(milliseconds);
		},
		restore: () => {
			story.tell("the server accepts connections again");
			return engine.host.restore;
		},
		resume: (source: "native" | "online" | "visibilitychange" | "pageshow") => {
			story.tell(`the client resumes through ${source}`);
			if (source === "native") {
				engine.native.resume();
			} else {
				engine.browser.fire(source);
			}
		},
		settlement: () => Effect.map(engine.connection().activity.current, (state) => (isClientSettled(state) ? "settled" : "pending")),
		silence: () => {
			story.tell("the network silently stops delivering frames on the open socket");
			return engine.host.silence;
		},
		status: () => Effect.map(engine.connection().activity.current, (state) => state.connectionStatus),
		untilConnected: () =>
			Stream.fromQueue(engine.events).pipe(
				Stream.filter((event) => event === "connected"),
				Stream.runHead,
			),
		untilWaiting: () => until(engine.connection().activity, (state) => state.connectionStatus === "waiting-for-connection", { name: "held command" }),
		value: () => {
			const { client, run } = engine.connection();
			return Effect.map(run(client.api.value.run()), (value) => `counter: ${value}`);
		},
	}),
});

export function connected(custom = false, shared = false) {
	return commands.trait(
		"connection",
		custom ? "a native socket protocol is supplied by the story" : "the default socket client is connected",
		function* (engine) {
			engine.state.connection = engine.connect(custom);
			const { client, run } = engine.connection();
			engine.registry.mount(client.runtime);
			yield* run(client.api.value.run());
			yield* Queue.take(engine.events);
			if (shared) {
				engine.state.connection = engine.connect(true, engine.connection().protocol);
				const peer = engine.connection();
				engine.registry.mount(peer.client.runtime);
				yield* peer.run(peer.client.api.value.run());
			}
		},
	);
}
