import { Effect, FileSystem, Layer, Path, Schema } from "effect";
import { prepareCodex } from "./codexPermissions.ts";
import { attemptMarker, codexPrompt } from "./codexPrompt.ts";
import { ChatGptAccount, decode, decodeResult, ThreadRead, ThreadStarted, TurnStarted } from "./codexProtocol.ts";
import { CodexRpc, codexRpcLayer } from "./codexRpc.ts";
import { AgentResult } from "./domain.ts";
import { Agent, type AgentRequest, type FleetError, failure, type Observation } from "./ports.ts";
export function codexAgentLayer() {
	return Layer.effect(
		Agent,
		Effect.gen(function* () {
			const rpc = yield* CodexRpc;
			const call = rpc.call;
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			return Agent.of({
				backendId: "codex-local",
				launch: (request, acknowledge) => launch(call, request, acknowledge, fs, path),
				observe: (request) => observe(call, request),
			});
		}),
	);
}
function launch(
	call: typeof CodexRpc.Service.call,
	request: AgentRequest,
	acknowledge: Parameters<typeof Agent.Service.launch>[1],
	fs: FileSystem.FileSystem,
	path: Path.Path,
): Effect.Effect<Observation, FleetError> {
	return Effect.gen(function* () {
		const account = yield* call("account/read", { refreshToken: false }).pipe(
			Effect.flatMap((value) => decode(ChatGptAccount, value)),
			Effect.mapError((error) => failure(error.message, "human")),
		);
		if (account.account?.type !== "chatgpt") {
			return yield* Effect.fail(failure("Local Codex requires an existing ChatGPT sign-in; API-key billing is not enabled", "human"));
		}
		const existing = request.attempt.ref;
		const configuration = yield* prepareCodex(request, call, fs, path).pipe(Effect.mapError((error) => failure(error.message, "human")));
		const started = yield* call(
			existing ? "thread/resume" : "thread/start",
			existing ? { ...configuration, threadId: existing.sessionId } : { ...configuration, ephemeral: false },
		).pipe(Effect.flatMap((value) => decode(ThreadStarted, value)));
		if (existing && started.thread.id !== existing.sessionId) {
			return yield* Effect.fail(failure("Codex resumed a different thread"));
		}
		const ref = { sessionId: started.thread.id, turnId: null };
		yield* acknowledge(ref);
		const turn = yield* call("turn/start", {
			approvalPolicy: "never",
			cwd: request.work.checkout,
			input: [{ text: codexPrompt(request), "text_elements": [], type: "text" }],
			outputSchema: Schema.toJsonSchemaDocument(AgentResult.members[request.attempt.role === "reviewer" ? 1 : 0]).schema,
			threadId: ref.sessionId,
		}).pipe(Effect.flatMap((value) => decode(TurnStarted, value)));
		const accepted = { ...ref, turnId: turn.turn.id };
		yield* acknowledge(accepted);
		return { ref: accepted, status: "pending" };
	});
}
function observe(call: typeof CodexRpc.Service.call, request: AgentRequest): Effect.Effect<Observation, FleetError> {
	return Effect.gen(function* () {
		const ref = request.attempt.ref;
		if (!ref) {
			return { message: "No durable Codex thread acknowledgement; replacement is not authorized", status: "unknown" };
		}
		const { thread } = yield* call("thread/read", { includeTurns: true, threadId: ref.sessionId }).pipe(
			Effect.flatMap((value) => decode(ThreadRead, value)),
		);
		if (thread.id !== ref.sessionId) {
			return { message: "Codex returned a different thread", status: "unknown" };
		}
		const matches = thread.turns.filter((candidate) =>
			ref.turnId
				? candidate.id === ref.turnId
				: candidate.items.some(
						(item) =>
							item.type === "userMessage"
							&& item.content?.some((part) => part.type === "text" && part.text?.startsWith(attemptMarker(request.attempt.id))),
					),
		);
		if (matches.length !== 1) {
			return { message: "Cannot uniquely reconcile the submitted Codex turn; no replacement was launched", status: "unknown" };
		}
		const turn = matches[0];
		if (!turn) {
			return { message: "Codex turn is absent", status: "unknown" };
		}
		return yield* observeTurn(thread, turn);
	});
}
function observeTurn(
	thread: typeof ThreadRead.Type.thread,
	turn: (typeof ThreadRead.Type.thread.turns)[number],
): Effect.Effect<Observation, FleetError> {
	return Effect.gen(function* () {
		const observedRef = { sessionId: thread.id, turnId: turn.id };
		if (turn.status === "failed" || turn.status === "interrupted") {
			return { message: `Codex turn ${turn.status}`, ref: observedRef, status: "failed" };
		}
		if (turn.status === "inProgress") {
			return thread.status.type === "active"
				? { ref: observedRef, status: "pending" }
				: { message: "Codex records an unfinished turn without an active executor", status: "unknown" };
		}
		if (turn.status !== "completed") {
			return { message: "Codex turn status is not recognized", status: "unknown" };
		}
		const final = turn.items.filter((item) => item.type === "agentMessage" && item.phase !== "commentary").at(-1);
		if (!final?.text) {
			return { message: "Completed Codex turn has no final result", ref: observedRef, status: "failed" };
		}
		const result = yield* decodeResult(final.text);
		return { ref: observedRef, result, status: "completed" };
	});
}
export function codexLayer(executable = "codex") {
	return codexAgentLayer().pipe(Layer.provide(codexRpcLayer(executable)));
}
