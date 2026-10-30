import { Data, Runtime } from "effect";

export class SetupFailure extends Data.TaggedError("SetupFailure")<{ readonly message: string; readonly cause?: unknown }> {
	constructor(options: { readonly message: string; readonly cause?: unknown }) {
		super({ message: options.message });
		Object.defineProperty(this, "cause", { enumerable: false, value: options.cause });
	}

	override readonly [Runtime.errorReported] = false;
	override readonly [Runtime.errorExitCode] = 2;
}

export class GateFailed extends Data.TaggedError("GateFailed") {
	override readonly [Runtime.errorReported] = false;
	override readonly [Runtime.errorExitCode] = 1;
}
