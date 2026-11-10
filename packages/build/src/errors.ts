import { Data } from "effect";

export class BuildFailure extends Data.TaggedError("BuildFailure")<{
	readonly message: string;
}> {}
