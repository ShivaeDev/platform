import { Data } from "effect";

export class PrismaError extends Data.TaggedError("PrismaError")<{
	readonly cause: unknown;
}> {}
