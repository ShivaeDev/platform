import { Data } from "effect";

export class PrismaError extends Data.TaggedError("PrismaError")<{
	readonly cause: unknown;
}> {}

export class TransactionExpired extends Data.TaggedError("TransactionExpired")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}
