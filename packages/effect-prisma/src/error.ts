import { Data, Redacted } from "effect";

export class PrismaRuntimeFailure extends Data.TaggedClass(
	"PrismaRuntimeFailure",
)<{
	readonly code: string;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export class PrismaQueryFailure extends Data.TaggedClass("PrismaQueryFailure")<{
	readonly sqlState?: string;
	readonly constraint?: string;
	readonly table?: string;
	readonly column?: string;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export class PrismaConnectionFailure extends Data.TaggedClass(
	"PrismaConnectionFailure",
)<{
	readonly transient?: boolean;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export type PrismaErrorReason =
	| PrismaRuntimeFailure
	| PrismaQueryFailure
	| PrismaConnectionFailure;

export class PrismaError extends Data.TaggedError("PrismaError")<{
	readonly reason: PrismaErrorReason;
}> {}

type PrismaFailure =
	| { readonly code: string }
	| {
			readonly kind: "sql_query";
			readonly sqlState?: string;
			readonly constraint?: string;
			readonly table?: string;
			readonly column?: string;
	  }
	| {
			readonly kind: "sql_connection";
			readonly transient?: boolean;
	  };

export const isPrismaFailure = (error: unknown): error is PrismaFailure => {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	if ("code" in error && typeof error.code === "string") {
		return true;
	}
	return (
		"kind" in error &&
		(error.kind === "sql_query" || error.kind === "sql_connection")
	);
};

export const toPrismaError = (error: PrismaFailure): PrismaError => {
	const original = Redacted.make(error);

	if ("kind" in error && error.kind === "sql_query") {
		return new PrismaError({
			reason: new PrismaQueryFailure({
				sqlState: error.sqlState,
				constraint: error.constraint,
				table: error.table,
				column: error.column,
				original,
			}),
		});
	}
	if ("kind" in error && error.kind === "sql_connection") {
		return new PrismaError({
			reason: new PrismaConnectionFailure({
				transient: error.transient,
				original,
			}),
		});
	}
	return new PrismaError({
		reason: new PrismaRuntimeFailure({
			code: error.code,
			original,
		}),
	});
};
