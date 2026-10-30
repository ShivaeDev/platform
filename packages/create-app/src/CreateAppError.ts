import { Data, Runtime } from "effect";

export class CreateAppError extends Data.TaggedError("CreateAppError")<{ readonly message: string }> {
	override readonly [Runtime.errorReported] = false;
}

export function createAppFailure(cause: unknown) {
	return new CreateAppError({ message: cause instanceof Error ? cause.message : String(cause) });
}
