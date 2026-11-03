import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { EffortLevel, SDKUserMessage, SessionStore } from "@anthropic-ai/claude-agent-sdk";
import { type Cause, Effect, Queue, Stream } from "effect";
import { BackendUnavailable } from "@shivaedev/agent/failures.ts";
import type { Input, StartRequest } from "@shivaedev/agent/run.ts";
import { consumeSession } from "#adapters/consumeSession.ts";
import { InputQueue } from "#adapters/InputQueue.ts";
import { repairSession } from "#adapters/repairSession.ts";
import type { Delivery } from "#adapters/sessionLanes.ts";
import { sessionOptions } from "#adapters/sessionOptions.ts";
import { makeToolServer } from "#adapters/toolServer.ts";
import { ClaudeProvider } from "#ClaudeProvider.ts";
import type { ClaudeOptions } from "#options.ts";

function unavailable(error: unknown) {
	return new BackendUnavailable({ backend: "claude-code", message: String(error) });
}

export const openSession = Effect.fn("ClaudeCode.openSession")(function* (
	request: StartRequest,
	config: ClaudeOptions,
	effort: EffortLevel | undefined,
	resume: string | undefined,
) {
	const peer = yield* ClaudeProvider;
	const deliveries = yield* Queue.unbounded<Delivery, BackendUnavailable | Cause.Done>();
	const tools = config.tools ?? [];
	const server =
		tools.length === 0
			? undefined
			: yield* Effect.acquireRelease(Effect.tryPromise({ catch: unavailable, try: () => makeToolServer(tools) }), (instance) =>
					Effect.promise(() => instance.close()),
				);
	return yield* Effect.acquireRelease(
		Effect.try({
			catch: unavailable,
			try: () => {
				let nativeRef = resume;
				let stopped = false;
				function deliver(delivery: Delivery) {
					if (delivery.kind === "frame" && delivery.message.type === "system" && delivery.message.subtype === "init") {
						nativeRef = delivery.message.session_id;
					}
					Queue.offerUnsafe(deliveries, delivery);
				}
				const inputIds = new Map<string, string>();
				const input = new InputQueue((message) => {
					const inputId = message.uuid === undefined ? undefined : inputIds.get(message.uuid);
					deliver({ kind: "frame", message, ...(inputId === undefined ? {} : { inputId }) });
				});
				const store: SessionStore = {
					append: (key, entries) => {
						deliver({ kind: "mirror", write: { entries, key } });
						return Promise.resolve();
					},
					load: () => Promise.resolve(null),
				};
				const live = peer.query({
					options: sessionOptions(request, config, store, effort, resume, server),
					prompt: input.stream(),
				});
				void consumeSession(
					live,
					input,
					deliveries,
					deliver,
					() =>
						stopped || nativeRef === undefined
							? Promise.resolve(undefined)
							: Effect.runPromise(repairSession(nativeRef, resolve(request.cwd)).pipe(Effect.provideService(ClaudeProvider, peer))),
					() => stopped,
				);
				return {
					close: () => {
						stopped = true;
						input.close();
						live.close();
						Queue.endUnsafe(deliveries);
					},
					deliveries: Stream.fromQueue(deliveries),
					interrupt: Effect.tryPromise({ catch: unavailable, try: () => live.interrupt() }),
					queue: (value: Input, priority?: SDKUserMessage["priority"]) => {
						const uuid = randomUUID();
						if (value.id !== undefined) {
							inputIds.set(uuid, value.id);
						}
						return input.push({
							message: { content: value.parts.map((part) => part.text).join("\n"), role: "user" },
							"parent_tool_use_id": null,
							type: "user",
							uuid,
							...(priority === undefined ? {} : { priority }),
						});
					},
				};
			},
		}),
		(session) => Effect.sync(session.close),
	);
});
