import { Data } from "effect";

export class HeavyLockError extends Data.TaggedError("HeavyLockError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export function failWith(message: string) {
	return (cause: unknown): HeavyLockError => new HeavyLockError({ cause, message });
}
