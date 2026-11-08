import { Data } from "effect";

export class MigrationFailure extends Data.TaggedError("MigrationFailure")<{
	readonly message: string;
}> {}
