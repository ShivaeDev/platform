import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Deferred, Effect } from "effect";
import { BackendUnavailable } from "@shivaedev/agent/failures.ts";

interface QueuedInput {
	readonly accepted: Deferred.Deferred<void, BackendUnavailable>;
	readonly message: SDKUserMessage;
}
function closedFailure() {
	return new BackendUnavailable({
		backend: "claude-code",
		message: "session closed before delivery reached the provider",
	});
}
// Claude accepts a user message when `query` pulls it from the prompt iterable.
export class InputQueue {
	readonly #buffer: QueuedInput[] = [];
	readonly #handOff: (message: SDKUserMessage) => void;
	#pending: ((result: IteratorResult<SDKUserMessage>) => void) | null = null;
	#done = false;
	constructor(handOff: (message: SDKUserMessage) => void) {
		this.#handOff = handOff;
	}
	#accept(input: QueuedInput): void {
		this.#handOff(input.message);
		Deferred.doneUnsafe(input.accepted, Effect.void);
	}
	#fail(input: QueuedInput): void {
		Deferred.doneUnsafe(input.accepted, Effect.fail(closedFailure()));
	}
	#offer(input: QueuedInput): void {
		if (this.#done) {
			this.#fail(input);
			return;
		}
		const pending = this.#pending;
		if (pending !== null) {
			this.#pending = null;
			pending({ done: false, value: input.message });
			this.#accept(input);
			return;
		}
		this.#buffer.push(input);
	}
	push(message: SDKUserMessage): Effect.Effect<void, BackendUnavailable> {
		const queue = this;
		return Effect.gen(function* () {
			const accepted = yield* Deferred.make<void, BackendUnavailable>();
			yield* Effect.sync(() => queue.#offer({ accepted, message }));
			yield* Deferred.await(accepted);
		});
	}
	close(): void {
		this.#done = true;
		for (const input of this.#buffer.splice(0)) {
			this.#fail(input);
		}
		const pending = this.#pending;
		if (pending !== null) {
			this.#pending = null;
			pending({ done: true, value: undefined });
		}
	}
	stream(): AsyncIterable<SDKUserMessage> {
		return {
			[Symbol.asyncIterator]: () => ({
				next: () => {
					const buffered = this.#buffer.shift();
					if (buffered !== undefined) {
						this.#accept(buffered);
						return Promise.resolve({
							done: false,
							value: buffered.message,
						});
					}
					if (this.#done) {
						return Promise.resolve({
							done: true as const,
							value: undefined,
						});
					}
					return new Promise((promiseResolve) => {
						this.#pending = promiseResolve;
					});
				},
			}),
		};
	}
}
