import { Effect, Fiber, Layer, Queue, Sink, Stream } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { ChildProcessSpawner } from "effect/unstable/process";
import { expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test";
import { decode, decodeJson, RpcMessage } from "#codexProtocol.ts";
import { CodexRpc, codexRpcLayer } from "#codexRpc.ts";
import { launchResponse, rpc } from "#test/support/codexFixtures.ts";

const { effectApp } = makeEffectIt({ layer: Layer.succeed(CodexRpc, rpc(launchResponse)), makeHarness: () => Effect.void });
const consume = Sink.forEach;
const protocolFixture = Effect.gen(function* () {
	const incoming = yield* Queue.make<Uint8Array>();
	const messages: Array<typeof RpcMessage.Type> = [];
	let released = false;
	function emit(message: unknown) {
		return Queue.offer(incoming, new TextEncoder().encode(`${JSON.stringify(message)}\n`));
	}
	const input = consume((bytes: Uint8Array) =>
		Effect.gen(function* () {
			const message = yield* decodeJson(new TextDecoder().decode(bytes)).pipe(
				Effect.flatMap((value) => decode(RpcMessage, value)),
				Effect.orDie,
			);
			messages.push(message);
			if (message.method === "initialize") {
				yield* emit({ id: message.id, result: { userAgent: "fixture" } });
			}
			if (message.method === "echo") {
				yield* emit({ id: message.id, result: { ok: true } });
			}
			if (message.method === "rejected") {
				yield* emit({ error: { code: -1, message: "Denied" }, id: message.id });
			}
		}),
	);
	const spawner = ChildProcessSpawner.make(() =>
		Effect.gen(function* () {
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					released = true;
				}),
			);
			return ChildProcessSpawner.makeHandle({
				all: Stream.never,
				exitCode: Effect.never,
				getInputFd: () => Sink.drain,
				getOutputFd: () => Stream.empty,
				isRunning: Effect.succeed(true),
				kill: () => Effect.void,
				pid: ChildProcessSpawner.ProcessId(1),
				stderr: Stream.never,
				stdin: input,
				stdout: Stream.fromQueue(incoming),
				unref: Effect.succeed(Effect.void),
			});
		}),
	);
	return {
		emit,
		layer: codexRpcLayer().pipe(Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))),
		messages,
		released: () => released,
	};
});
effectApp("stdio transport initializes, correlates replies, refuses permissions, and releases its child", function* () {
	const fixture = yield* protocolFixture;
	yield* Effect.gen(function* () {
		const client = yield* CodexRpc;
		expect(yield* client.call("echo", {})).toEqual({ ok: true });
		yield* fixture.emit({ id: "permission-1", method: "item/commandExecution/requestApproval", params: {} });
		yield* client.call("echo", {});
		expect(fixture.messages).toContainEqual({
			error: { code: -32_601, message: "Work Fleet does not grant interactive permissions" },
			id: "permission-1",
		});
		const rejected = yield* client.call("rejected", {}).pipe(Effect.result);
		expect(rejected._tag).toBe("Failure");
	}).pipe(Effect.provide(fixture.layer));
	expect(fixture.released()).toBe(true);
	expect(fixture.messages.slice(0, 2).map((message) => message.method)).toEqual(["initialize", "initialized"]);
});
effectApp("unacknowledged RPC calls time out through the Effect test clock without retry", function* () {
	const fixture = yield* protocolFixture;
	yield* Effect.gen(function* () {
		const client = yield* CodexRpc;
		const waiting = yield* client.call("uncertain", {}).pipe(Effect.result, Effect.forkChild);
		yield* TestClock.adjust("31 seconds");
		const result = yield* Fiber.join(waiting);
		expect(result._tag).toBe("Failure");
		expect(fixture.messages.filter((message) => message.method === "uncertain")).toHaveLength(1);
	}).pipe(Effect.provide(fixture.layer));
});
