import { Data } from "effect";

export class CiFailure extends Data.TaggedError("CiFailure")<{ readonly message: string }> {}
