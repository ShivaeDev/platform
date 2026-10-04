import { Context, Deferred, Effect, Layer, Queue, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { decode, decodeJson, RpcMessage } from "./codexProtocol.ts";
import { type FleetError, failure } from "./ports.ts";
export class CodexRpc extends Context.Service<
	CodexRpc,
	{
		readonly call: (method: string, params: unknown) => Effect.Effect<unknown, FleetError>;
	}
>()("@shivaedev/work-fleet/CodexRpc") {}
export function codexRpcLayer(executable = "codex") {
	return Layer.effect(
		CodexRpc,
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const process = yield* spawner
				.spawn(ChildProcess.make(executable, ["app-server", "--listen", "stdio://"], { stderr: "pipe", stdin: "pipe", stdout: "pipe" }))
				.pipe(Effect.mapError(() => failure("Could not start local Codex app-server")));
			const output = yield* Queue.make<Uint8Array>();
			const pending = new Map<number, Deferred.Deferred<unknown, FleetError>>();
			let sequence = 0;
			let closed = false;
			function send(value: unknown) {
				return Queue.offer(output, new TextEncoder().encode(`${JSON.stringify(value)}\n`));
			}
			const close = Effect.gen(function* () {
				closed = true;
				for (const waiter of pending.values()) {
					yield* Deferred.fail(waiter, failure("Codex connection closed; reconcile submitted attempts"));
				}
				pending.clear();
			});
			yield* Effect.addFinalizer(() => close);
			yield* Stream.fromQueue(output).pipe(
				Stream.run(process.stdin),
				Effect.catchCause(() => close),
				Effect.forkScoped,
			);
			yield* process.stderr.pipe(
				Stream.runDrain,
				Effect.catchCause(() => close),
				Effect.forkScoped,
			);
			yield* process.stdout.pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.runForEach((line) =>
					decodeJson(line).pipe(
						Effect.flatMap((value) => decode(RpcMessage, value)),
						Effect.flatMap((message) => handleMessage(message, pending, send)),
					),
				),
				Effect.ensuring(close),
				Effect.catchCause(() => close),
				Effect.forkScoped,
			);
			function call(method: string, params: unknown) {
				return Effect.gen(function* () {
					if (closed) {
						return yield* Effect.fail(failure("Codex connection is closed"));
					}
					sequence += 1;
					const id = sequence;
					const waiter = yield* Deferred.make<unknown, FleetError>();
					pending.set(id, waiter);
					return yield* Effect.gen(function* () {
						yield* send({ id, method, params });
						return yield* Deferred.await(waiter);
					}).pipe(
						Effect.timeout("30 seconds"),
						Effect.mapError(() => failure("Codex request did not acknowledge; reconcile before retrying")),
						Effect.ensuring(Effect.sync(() => pending.delete(id))),
					);
				});
			}
			yield* call("initialize", { clientInfo: { name: "work_fleet", title: "Work Fleet", version: "0.1.0" } });
			yield* send({ method: "initialized" });
			return { call };
		}),
	);
}
function handleMessage(
	message: typeof RpcMessage.Type,
	pending: Map<number, Deferred.Deferred<unknown, FleetError>>,
	send: (value: unknown) => Effect.Effect<boolean>,
) {
	return Effect.gen(function* () {
		if (message.method !== undefined) {
			if (message.id !== undefined) {
				yield* send({ error: { code: -32_601, message: "Work Fleet does not grant interactive permissions" }, id: message.id });
			}
			return;
		}
		if (typeof message.id !== "number") {
			return;
		}
		const waiter = pending.get(message.id);
		if (!waiter) {
			return;
		}
		if (message.error) {
			yield* Deferred.fail(waiter, failure(`Codex request failed (${message.error.code})`));
		} else {
			yield* Deferred.succeed(waiter, message.result);
		}
	});
}
