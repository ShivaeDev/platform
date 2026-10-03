import { Data } from "effect";

export class HeavyLockError extends Data.TaggedError("HeavyLockError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export const failWith =
	(message: string) =>
	(cause: unknown): HeavyLockError =>
		new HeavyLockError({ cause, message });
