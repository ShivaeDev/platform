import { Data } from "effect";

export class BoundaryFailure extends Data.TaggedError("BoundaryFailure")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}
