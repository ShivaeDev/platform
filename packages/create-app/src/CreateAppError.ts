import { Data, Runtime } from "effect";

export class CreateAppError extends Data.TaggedError("CreateAppError")<{ readonly message: string }> {
	override readonly [Runtime.errorReported] = false;
}
