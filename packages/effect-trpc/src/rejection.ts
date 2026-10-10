import { type TRPC_ERROR_CODE_KEY, TRPCError } from "@trpc/server";
import { Effect, Schema } from "effect";

const TAXONOMY_CODES = new Map<string, TRPC_ERROR_CODE_KEY>([
	["NotFound", "NOT_FOUND"],
	["Unauthorized", "UNAUTHORIZED"],
	["Forbidden", "FORBIDDEN"],
	["Conflict", "CONFLICT"],
	["PreconditionFailed", "PRECONDITION_FAILED"],
	["TooManyRequests", "TOO_MANY_REQUESTS"],
	["AuthUnavailable", "SERVICE_UNAVAILABLE"],
]);

export const rejectionCode = (tag: string): TRPC_ERROR_CODE_KEY => TAXONOMY_CODES.get(tag) ?? "BAD_REQUEST";

const DeclaredRejection = Schema.StructWithRest(Schema.Struct({ _tag: Schema.String }), [Schema.Record(Schema.String, Schema.Unknown)]);

export type DeclaredRejection = typeof DeclaredRejection.Type;

interface InvalidInputIsReserved {
	readonly "invalidInput is reserved for the mark on input that did not parse": never;
}

interface DeclaredEncoding {
	readonly _tag: string;
	readonly invalidInput?: InvalidInputIsReserved;
}

export class RejectionError extends TRPCError {
	readonly rejection: DeclaredRejection;

	constructor(rejection: DeclaredRejection, code: TRPC_ERROR_CODE_KEY = rejectionCode(rejection._tag)) {
		super({ code, message: typeof rejection.message === "string" ? rejection.message : rejection._tag });
		this.rejection = rejection;
	}
}

export interface RejectWithOptions<Tag extends string> {
	readonly code?: (tag: Tag) => TRPC_ERROR_CODE_KEY;
}

function encodeRejection(schema: Schema.Constraint) {
	const encode = Schema.encodeUnknownEffect(schema);
	const tagged = Schema.decodeUnknownEffect(DeclaredRejection);
	return (rejection: unknown) => Effect.orDie(Effect.flatMap(encode(rejection), tagged));
}

export function rejectWith<S extends Schema.ConstraintCodec<{ readonly _tag: string }, DeclaredEncoding, unknown, unknown>>(
	schema: S,
	options?: RejectWithOptions<S["Type"]["_tag"]>,
): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Exclude<E, S["Type"]> | RejectionError, R | S["EncodingServices"]>;
export function rejectWith(schema: Schema.Constraint, options?: RejectWithOptions<string>) {
	const is = Schema.is(schema);
	const encode = encodeRejection(schema);
	const code = options?.code ?? rejectionCode;
	return <A, E, R>(self: Effect.Effect<A, E, R>) =>
		Effect.catchIf(self, is, (rejection) =>
			Effect.flatMap(encode(rejection), (encoded) => Effect.fail(new RejectionError(encoded, code(encoded._tag)))),
		);
}
