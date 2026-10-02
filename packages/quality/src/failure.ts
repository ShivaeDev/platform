import { Data, Runtime } from "effect";

export class SetupFailure extends Data.TaggedError("SetupFailure")<{ readonly message: string }> {
	override readonly [Runtime.errorReported] = false;
	override readonly [Runtime.errorExitCode] = 2;
}

export class GateFailed extends Data.TaggedError("GateFailed") {
	override readonly [Runtime.errorReported] = false;
	override readonly [Runtime.errorExitCode] = 1;
}
