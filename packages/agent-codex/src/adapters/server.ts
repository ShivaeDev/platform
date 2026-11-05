import process from "node:process";
import { Clock, Context, Deferred, Effect, Exit, Fiber, Option, PubSub, Queue, Schema, type Scope } from "effect";
import { BackendUnavailable } from "@shivaedev/agent/failures.ts";
import { connect } from "#adapters/connect.ts";
import { handshake } from "#adapters/handshake.ts";
import { ProcessSpawner } from "#adapters/process.ts";
import { DynamicToolCallParams } from "#adapters/protocol.ts";
import { residualApproval } from "#adapters/residualApproval.ts";
import type { RpcNotification } from "#adapters/rpc.ts";
import { tellCliVersionOnce } from "#adapters/tellCliVersionOnce.ts";
import { openThreadClaims } from "#adapters/threadClaims.ts";
import type { CodexConfiguration } from "#config.ts";
export const openServer = Effect.fn("Codex.openServer")(function* (config: CodexConfiguration) {
	const spawner = yield* ProcessSpawner;
	const notifications = yield* PubSub.unbounded<RpcNotification>();
	const requests = yield* Queue.unbounded<{ id: number | string; method: string; params: unknown }>();
	const exited = yield* Deferred.make<void>();
	const stderr = yield* Queue.unbounded<string>();
	const child = yield* Effect.acquireRelease(
		Effect.try({
			catch: () => new BackendUnavailable({ backend: "codex", message: "Could not start Codex app-server" }),
			try: () => spawner.spawn({ args: config.args ?? ["app-server"], command: config.command ?? "codex", cwd: config.cwd ?? process.cwd() }),
		}),
		(processHandle) => Effect.sync(() => processHandle.kill()),
	);
	const rpc = connect(
		child,
		config.requestTimeoutMs ?? 30_000,
		(n) => {
			PubSub.publishUnsafe(notifications, n);
		},
		(id, method, params) => {
			PubSub.publishUnsafe(notifications, { method, params });
			Queue.offerUnsafe(requests, { id, method, params });
		},
		() => {
			Deferred.doneUnsafe(exited, Effect.void);
		},
	);
	child.onStderr((text) => {
		Queue.offerUnsafe(stderr, text);
	});
	yield* Effect.forkScoped(
		Queue.take(stderr).pipe(
			Effect.flatMap((text) => Effect.logWarning("Codex app-server", { stderr: text })),
			Effect.forever,
		),
	);
	const claims = openThreadClaims();
	const registrations = new Map<string, Scope.Scope>();
	const handle = Effect.fn("Codex.handle")(function* (request: { id: number | string; method: string; params: unknown }) {
		if (request.method === "currentTime/read") {
			const millis = yield* Clock.currentTimeMillis;
			yield* Effect.sync(() => rpc.respond(request.id, { currentTimeAt: Math.floor(millis / 1000) }));
			return;
		}
		const declined = residualApproval(request);
		if (declined._tag === "Some") {
			yield* Effect.sync(() => rpc.respond(request.id, declined.value));
			return;
		}
		if (request.method !== "item/tool/call") {
			yield* Effect.sync(() => rpc.deny(request.id));
			return;
		}
		const call = Schema.decodeUnknownOption(DynamicToolCallParams)(request.params);
		const tool =
			Option.isSome(call) && registrations.has(call.value.threadId)
				? config.tools?.find((candidate) => candidate.name === call.value.tool)
				: undefined;
		const callScope = Option.isSome(call) ? registrations.get(call.value.threadId) : undefined;
		const outcome =
			tool !== undefined && Option.isSome(call) && callScope !== undefined
				? yield* tool.execute(call.value.arguments, call.value.callId).pipe(
						Effect.forkIn(callScope),
						Effect.flatMap(Fiber.await),
						Effect.map((exit) => (Exit.isSuccess(exit) ? exit.value : { ok: false, text: "The session closed or tool execution failed" })),
					)
				: { ok: false, text: "No registered tool for this thread" };
		yield* Effect.sync(() => rpc.respond(request.id, { contentItems: [{ text: outcome.text, type: "inputText" }], success: outcome.ok }));
	});
	yield* Effect.forkScoped(
		Queue.take(requests).pipe(
			Effect.flatMap((request) => Effect.forkScoped(handle(request))),
			Effect.forever,
		),
	);
	const version = yield* handshake(rpc.request);
	yield* Effect.sync(() => rpc.notify("initialized", {}));
	const tell = yield* tellCliVersionOnce;
	yield* tell(version);
	return { ...rpc, claims, exited: Deferred.await(exited), notifications, registrations };
});
export type CodexServer = Effect.Success<ReturnType<typeof openServer>>;

export class AppServer extends Context.Service<AppServer, CodexServer>()("@shivaedev/agent-codex/AppServer") {}
