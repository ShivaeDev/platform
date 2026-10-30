import { Data, Runtime } from "effect";

export class SkillsError extends Data.TaggedError("SkillsError")<{ readonly message: string; readonly cause?: unknown }> {
	override readonly [Runtime.errorReported] = false;
}
