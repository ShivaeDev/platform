import type { SDKMessage, SDKUserMessage, SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import { type Cause, Effect, Queue, Stream } from "effect";
import type { ClaudeProvider } from "#adapters/ClaudeProvider.ts";
import { init, NATIVE_SESSION } from "#test/frames.ts";
export const scriptedPeer = Effect.gen(function* () {
	const frames = yield* Queue.unbounded<SDKMessage, Cause.Done | Error>();
	const received = yield* Queue.unbounded<SDKUserMessage>();
	const inputs: SDKUserMessage[] = [];
	const requests: Parameters<ClaudeProvider["Service"]["query"]>[0][] = [];
	const transcripts = new Map<string, SessionMessage[]>();
	const counters = { census: 0, closed: 0, interrupted: 0 };
	let censusFailure: string | undefined;
	let suppressInit = false;
	let takeInput: (() => Promise<void>) | undefined;
	const service: ClaudeProvider["Service"] = {
		getSubagentMessages: (_session, id) => Promise.resolve(transcripts.get(id) ?? []),
		listSubagents: () => {
			counters.census += 1;
			if (censusFailure !== undefined) {
				return Promise.reject(new Error(censusFailure));
			}
			return Promise.resolve([...transcripts.keys()]);
		},
		query: (request) => {
			requests.push(request);
			const iterable = request.prompt[Symbol.asyncIterator]();
			takeInput = async () => {
				const next = await iterable.next();
				if (!next.done) {
					inputs.push(next.value);
					Queue.offerUnsafe(received, next.value);
				}
			};
			async function boot() {
				await takeInput?.();
				if (!suppressInit) {
					Queue.offerUnsafe(frames, init(request.options.resume ?? NATIVE_SESSION));
				}
			}
			void boot();
			return {
				[Symbol.asyncIterator]: () => Stream.toAsyncIterable(Stream.fromQueue(frames))[Symbol.asyncIterator](),
				close: () => {
					counters.closed += 1;
					Queue.endUnsafe(frames);
				},
				interrupt: () => {
					counters.interrupted += 1;
					return Promise.resolve(undefined);
				},
			};
		},
	};
	return {
		counters,
		failCensus: (reason: string) => {
			censusFailure = reason;
		},
		frames,
		inputs,
		loseInit: () => {
			suppressInit = true;
		},
		pull: () => Effect.promise(() => takeInput?.() ?? Promise.resolve()),
		received,
		requests,
		service,
		transcripts,
	};
});
export type ScriptedPeer = Effect.Success<typeof scriptedPeer>;
