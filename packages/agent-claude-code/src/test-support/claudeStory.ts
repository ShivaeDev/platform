import { resolve } from "node:path";
import type { SDKMessage, SessionKey, SessionStoreEntry } from "@anthropic-ai/claude-agent-sdk";
import { Cause, Effect, Exit, Fiber, Queue, Scope, Stream } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { type Agent, Backend } from "@shivaedev/agent/backend.ts";
import type { Transcript } from "@shivaedev/agent/events.ts";
import type { Receipt } from "@shivaedev/agent/run.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ClaudeProvider } from "#adapters/ClaudeProvider.ts";
import { makeClaudeBackend } from "#claudeCode.ts";
import type { ClaudeOptions } from "#options.ts";
import { stamp } from "#test/frames.ts";
import { scriptedPeer } from "#test/scriptedPeer.ts";

function input(text: string) {
	return { parts: [{ text, type: "text" }] } as const;
}
export const claude = storyKit({
	create: () =>
		Effect.gen(function* () {
			const peer = yield* scriptedPeer;
			const config: {
				options: ClaudeOptions;
			} = { options: {} };
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const tools: {
				args: unknown;
				callId: string;
			}[] = [];
			const state: {
				agent?: Agent<"sessions" | "queuedInput" | "steering" | "interruption" | "transcript">;
				receipt?: Receipt;
			} = {};
			return { config, peer, scope, state, tools };
		}),
	name: "Claude Code provider protocol",
	stages: ["provider"],
	verbs: (engine, story) => {
		function agent() {
			if (engine.state.agent === undefined) {
				throw new Error("Start a run first");
			}
			return engine.state.agent;
		}
		function receipt() {
			if (engine.state.receipt === undefined) {
				throw new Error("Start a run first");
			}
			return engine.state.receipt;
		}
		const connect = Effect.gen(function* () {
			if (engine.state.agent !== undefined) {
				return engine.state.agent;
			}
			const backend = yield* makeClaudeBackend(engine.config.options).pipe(Effect.provideService(ClaudeProvider, engine.peer.service));
			engine.state.agent = yield* requireFeatures(["sessions", "queuedInput", "steering", "interruption", "transcript"]).pipe(
				Effect.provideService(Backend, backend),
			);
			return engine.state.agent;
		});
		const settle = Effect.gen(function* () {
			const uuid = stamp();
			yield* Queue.offer(engine.peer.frames, { "session_id": "session", status: null, subtype: "status", type: "system", uuid });
			yield* agent()
				.events(receipt())
				.pipe(
					Stream.filter((event) => event.raw?.payload.includes(uuid) === true),
					Stream.runHead,
				);
		});
		let pending: Fiber.Fiber<void, import("@shivaedev/agent/failures.ts").BackendFailure> | undefined;
		let starting: Fiber.Fiber<Receipt, import("@shivaedev/agent/failures.ts").BackendFailure> | undefined;
		return {
			beginQueue: (text: string) =>
				Effect.gen(function* () {
					pending = yield* agent().queuedInput.queue(receipt(), input(text)).pipe(Effect.forkScoped);
				}),
			beginStart: () =>
				Effect.gen(function* () {
					const facade = yield* connect;
					starting = yield* facade
						.start({ cwd: "project", input: input("Build"), operationId: "lost-ack" })
						.pipe(Effect.provideService(Scope.Scope, engine.scope), Effect.forkScoped);
					yield* Queue.take(engine.peer.received);
				}),
			canonical: (path: string) => Effect.sync(() => resolve(path)),
			close: () => Scope.close(engine.scope, Exit.void),
			counters: () => Effect.sync(() => ({ ...engine.peer.counters })),
			endProvider: () => Queue.end(engine.peer.frames),
			failProvider: () => Queue.failCause(engine.peer.frames, Cause.fail(new Error("provider connection lost"))),
			finish: () => Queue.end(engine.peer.frames).pipe(Effect.andThen(Stream.runDrain(agent().events(receipt())))),
			frame: (message: SDKMessage) => Queue.offer(engine.peer.frames, message).pipe(Effect.andThen(settle)),
			inputs: () => Effect.sync(() => [...engine.peer.inputs]),
			inspect: () => agent().inspect(receipt()),
			interrupt: () => agent().interruption.interrupt(receipt()),
			messages: () => agent().transcript.read(receipt()).pipe(Effect.map(transcriptMessages)),
			mirror: (key: SessionKey, entries: SessionStoreEntry[]) =>
				Effect.promise(async () => {
					const store = engine.peer.requests.at(-1)?.options.sessionStore;
					if (store === undefined) {
						throw new Error("No transcript mirror installed");
					}
					await store.append(key, entries);
				}).pipe(Effect.andThen(settle)),
			pullInput: () => engine.peer.pull().pipe(Effect.andThen(() => (pending === undefined ? Effect.void : Fiber.join(pending)))),
			queue: (text: string) =>
				Effect.gen(function* () {
					story.tell("the application queues text");
					const sending = yield* agent().queuedInput.queue(receipt(), input(text)).pipe(Effect.forkScoped);
					yield* engine.peer.pull();
					yield* Fiber.join(sending);
				}),
			queueOutcome: () => {
				if (pending === undefined) {
					throw new Error("Queue input first");
				}
				return Fiber.join(pending).pipe(
					Effect.as("accepted"),
					Effect.catchTag("BackendUnavailable", (error) => Effect.succeed(error.message)),
				);
			},
			queueStatus: () =>
				Effect.gen(function* () {
					if (pending === undefined) {
						throw new Error("Queue input first");
					}
					const result = pending.pollUnsafe();
					if (result === undefined) {
						return "waiting";
					}
					return yield* Fiber.join(pending).pipe(
						Effect.as("accepted"),
						Effect.catchTag("BackendUnavailable", (error) => Effect.succeed(error.message)),
					);
				}),
			readFailure: () =>
				Stream.runDrain(agent().events(receipt())).pipe(
					Effect.as("completed"),
					Effect.catchTag("BackendUnavailable", (error) => Effect.succeed(error.message)),
				),
			reconcile: (operationId: string) => agent().reconcile(operationId),
			rejectEffort: (effort: string) =>
				connect.pipe(
					Effect.flatMap((facade) => facade.start({ cwd: "project", effort, input: input("Build"), operationId: "invalid-effort" })),
					Effect.map(() => ({ outcome: "accepted" })),
					Effect.catchTag("Rejected", (error) => Effect.succeed({ outcome: "rejected", reason: error.message })),
				),
			requests: () =>
				Effect.sync(() =>
					engine.peer.requests.map((request) => ({
						cwd: request.options.cwd ?? "provider default",
						effort: request.options.effort ?? "provider default",
						resume: request.options.resume ?? "new session",
					})),
				),
			resume: (session: string) =>
				Effect.gen(function* () {
					story.tell("the application resumes a native Claude session");
					const facade = yield* connect;
					engine.state.receipt = yield* facade.sessions
						.resume({ value: session, version: 1 }, { cwd: "project", input: input("Continue"), operationId: "resume" })
						.pipe(Effect.provideService(Scope.Scope, engine.scope));
					return engine.state.receipt;
				}),
			start: (text = "Build the app", cwd = "./project/../project", effort?: string) =>
				Effect.gen(function* () {
					story.tell("the application starts a Claude run");
					const facade = yield* connect;
					engine.state.receipt = yield* facade
						.start({ cwd, input: input(text), operationId: "build", ...(effort === undefined ? {} : { effort }) })
						.pipe(Effect.provideService(Scope.Scope, engine.scope));
					return engine.state.receipt;
				}),
			startOutcome: () =>
				Effect.gen(function* () {
					if (starting === undefined) {
						throw new Error("Submit work first");
					}
					return yield* Fiber.join(starting).pipe(
						Effect.as("accepted"),
						Effect.catchTag("UnknownAcceptance", (error) => Effect.succeed({ operationId: error.operationId, outcome: "unknown acceptance" })),
					);
				}),
			steer: (text: string) =>
				Effect.gen(function* () {
					story.tell("the application steers active work");
					const sending = yield* agent().steering.steer(receipt(), input(text)).pipe(Effect.forkScoped);
					yield* engine.peer.pull();
					yield* Fiber.join(sending);
				}),
			tool: (name: string, args: Record<string, unknown>) =>
				Effect.acquireRelease(
					Effect.promise(async () => {
						const [{ Client }, { InMemoryTransport }] = await Promise.all([
							import("@modelcontextprotocol/sdk/client/index.js"),
							import("@modelcontextprotocol/sdk/inMemory.js"),
						]);
						const server = engine.peer.requests.at(-1)?.options.mcpServers?.platform;
						if (server?.type !== "sdk") {
							throw new Error("No SDK MCP server configured");
						}
						const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
						await server.instance.connect(serverTransport);
						const client = new Client({ name: "claude-peer", version: "0.0.0" });
						await client.connect(clientTransport);
						return client;
					}),
					(client) => Effect.promise(() => client.close()),
				).pipe(Effect.flatMap((client) => Effect.promise(() => client.callTool({ arguments: args, name })))),
			toolCalls: () => Effect.sync(() => [...engine.tools]),
			transcript: () => agent().transcript.read(receipt()),
		};
	},
});
export function savedSubagent(id: string, messages: import("@anthropic-ai/claude-agent-sdk").SessionMessage[]) {
	return claude.trait("provider", `the provider stored ${id}'s transcript`, (engine) => {
		engine.peer.transcripts.set(id, messages);
	});
}
export const unreadableCensus = claude.trait("provider", "the provider cannot list its subagent transcripts", (engine) => {
	engine.peer.failCensus("transcript directory unavailable");
});
export const missingAcknowledgement = claude.trait("provider", "the provider loses its native acknowledgement", (engine) => {
	engine.peer.loseInit();
});
export const boundTool = claude.trait("provider", "the application binds a lookup tool", (engine) => {
	engine.config.options = {
		tools: [
			{
				call: (args, callId) =>
					Effect.sync(() => {
						engine.tools.push({ args, callId });
						return { ok: true, text: "Found the item" };
					}),
				description: "Look up an item",
				inputSchema: { properties: { name: { type: "string" } } },
				name: "lookup",
			},
		],
	};
});

function transcriptMessages(transcript: Transcript) {
	return transcript.events
		.filter((event) => event.type === "message")
		.flatMap((event) => event.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])));
}
