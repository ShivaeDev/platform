import { Data } from "effect";

export class VitestRerunError extends Data.TaggedError("VitestRerunError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export function failWith(message: string) {
	return (cause: unknown): VitestRerunError => new VitestRerunError({ cause, message });
}
