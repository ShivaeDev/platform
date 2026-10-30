import { Data, Runtime } from "effect";

export class BrowserCheckError extends Data.TaggedError("BrowserCheckError")<{ readonly message: string }> {
	override readonly [Runtime.errorReported] = false;
}
