import { Data } from "effect";

export class RenderFailed extends Data.TaggedError("RenderFailed")<{ readonly cause: unknown }> {}
