import { Schema } from "effect";

const described = { message: Schema.String };
const perField = { field: Schema.optionalKey(Schema.String), message: Schema.String };
export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", described) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", described) {}
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", described) {}
export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", perField) {}
export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", perField) {}
export class PreconditionFailed extends Schema.TaggedError<PreconditionFailed>()("PreconditionFailed", described) {}
export class TooManyRequests extends Schema.TaggedError<TooManyRequests>()("TooManyRequests", described) {}
export class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()("AuthUnavailable", described) {}
export class InternalServerError extends Schema.TaggedError<InternalServerError>()("InternalServerError", described) {}
export class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()("ServiceUnavailable", described) {}

export function isNotFound(value: unknown): value is NotFound {
	return value instanceof NotFound;
}
export function isUnauthorized(value: unknown): value is Unauthorized {
	return value instanceof Unauthorized;
}
export function isForbidden(value: unknown): value is Forbidden {
	return value instanceof Forbidden;
}
export function isBadRequest(value: unknown): value is BadRequest {
	return value instanceof BadRequest;
}
export function isConflict(value: unknown): value is Conflict {
	return value instanceof Conflict;
}
export function isPreconditionFailed(value: unknown): value is PreconditionFailed {
	return value instanceof PreconditionFailed;
}
export function isTooManyRequests(value: unknown): value is TooManyRequests {
	return value instanceof TooManyRequests;
}
export function isAuthUnavailable(value: unknown): value is AuthUnavailable {
	return value instanceof AuthUnavailable;
}
export function isInternalServerError(value: unknown): value is InternalServerError {
	return value instanceof InternalServerError;
}
export function isServiceUnavailable(value: unknown): value is ServiceUnavailable {
	return value instanceof ServiceUnavailable;
}
