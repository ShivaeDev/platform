import { Effect, Schema } from "effect";

const described = { message: Schema.String };
const perField = { field: Schema.optionalKey(Schema.String), message: Schema.String };
export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", described) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", described) {}
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", described) {}
export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", perField) {}
export class PreconditionFailed extends Schema.TaggedError<PreconditionFailed>()("PreconditionFailed", described) {}
export class TooManyRequests extends Schema.TaggedError<TooManyRequests>()("TooManyRequests", described) {}
export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", perField) {}
export class Throttled extends Schema.TaggedError<Throttled>()("Throttled", { retryAfter: Schema.NumberFromString }) {}
export class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()("AuthUnavailable", described) {}
export class Undeclared extends Schema.TaggedError<Undeclared>()("Undeclared", { field: Schema.String, message: Schema.String }) {}
export const Rejection = Schema.Union([
	NotFound,
	Unauthorized,
	Forbidden,
	Conflict,
	PreconditionFailed,
	TooManyRequests,
	BadRequest,
	AuthUnavailable,
	Throttled,
]);
const SECRET = "postgres://app:hunter2@db.internal/app";
const failures = {
	busy: new TooManyRequests({ message: "Slow down" }),
	empty: new BadRequest({ field: "name", message: "Name is required" }),
	forbidden: new Forbidden({ message: "Not yours" }),
	notFound: new NotFound({ message: "No profile" }),
	outage: new AuthUnavailable({ message: "Sessions are unavailable" }),
	stale: new PreconditionFailed({ message: "Profile changed" }),
	taken: new Conflict({ field: "name", message: "Name is taken" }),
	throttled: new Throttled({ retryAfter: 30 }),
	unauthorized: new Unauthorized({ message: "Sign in" }),
	undeclared: new Undeclared({ field: "password", message: SECRET }),
};
export function rename(name: string, retryAfter = failures.throttled.retryAfter) {
	if (name === "throttled") {
		return Effect.fail(new Throttled({ retryAfter }));
	}
	const failure = Object.entries(failures).find(([key]) => key === name)?.[1];
	return failure === undefined ? Effect.succeed(`renamed:${name}`) : Effect.fail(failure);
}
