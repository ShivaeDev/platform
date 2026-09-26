import { Data, Runtime } from "effect";

/** The check could not run: invalid configuration, unreadable input or a crashed rule. Exits 2. */
export class SetupFailure extends Data.TaggedError("SetupFailure")<{ readonly message: string }> {
	override readonly [Runtime.errorReported] = false;
	override readonly [Runtime.errorExitCode] = 2;
}

/** The check ran and the repository fails the gate. The report is already printed. Exits 1. */
export class GateFailed extends Data.TaggedError("GateFailed") {
	override readonly [Runtime.errorReported] = false;
	override readonly [Runtime.errorExitCode] = 1;
}
