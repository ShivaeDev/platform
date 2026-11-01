import { constants } from "node:os";
import process from "node:process";
import { Effect, type PlatformError, Queue } from "effect";

const FORWARDED = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

export type ForwardedSignal = (typeof FORWARDED)[number];

export function signalExitCode(signal: string): number {
	return 128 + (Object.entries(constants.signals).find(([name]) => name === signal)?.[1] ?? 0);
}

const KILLED_BY = /signal: '(?<signal>SIG[A-Z0-9]+)'/u;

// The spawner reports a child killed by a signal only as an error naming that signal.
export function signalledExitCode(error: PlatformError.PlatformError) {
	const signal = KILLED_BY.exec(error.cause instanceof Error ? error.cause.message : "")?.groups?.signal;
	return signal === undefined ? Effect.fail(error) : Effect.succeed(signalExitCode(signal));
}

// Listening replaces Node's default of dying on these signals, so the lock is released and the child's exit decides ours.
export const receiveSignals = Effect.gen(function* () {
	const received = yield* Queue.unbounded<ForwardedSignal>();
	const listeners = FORWARDED.map((signal) => [signal, () => Queue.offerUnsafe(received, signal)] as const);
	yield* Effect.acquireRelease(
		Effect.sync(() => {
			for (const [signal, listener] of listeners) {
				process.on(signal, listener);
			}
		}),
		() =>
			Effect.sync(() => {
				for (const [signal, listener] of listeners) {
					process.off(signal, listener);
				}
			}),
	);
	return received;
});
