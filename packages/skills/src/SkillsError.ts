import { Data, Runtime } from "effect";

export class SkillsError extends Data.TaggedError("SkillsError")<{ readonly message: string }> {
	override readonly [Runtime.errorReported] = false;
}
