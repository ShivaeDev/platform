import { Option, Predicate } from "effect";
import { rejectedField } from "@shivaedev/errors/rejectedField.ts";
import {
	BadRequest,
	Conflict,
	Forbidden,
	InternalServerError,
	NotFound,
	PreconditionFailed,
	ServiceUnavailable,
	TooManyRequests,
} from "@shivaedev/errors/taxonomy.ts";

const decodedClasses = { BadRequest, Conflict, Forbidden, InternalServerError, NotFound, PreconditionFailed, ServiceUnavailable, TooManyRequests };

export function rejectionAnswer(error: unknown, extra: Readonly<Record<string, new (...args: never[]) => unknown>> = {}): string {
	if (!(Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag))) {
		return `untagged ${JSON.stringify(error)}`;
	}
	const decoded = { ...decodedClasses, ...extra }[error._tag];
	if (decoded === undefined || !(error instanceof decoded)) {
		return `undecoded ${error._tag}`;
	}
	const message = Predicate.hasProperty(error, "message") ? String(error.message) : "";
	return Option.match(rejectedField(error), {
		onNone: () => `${error._tag}: ${message}`,
		onSome: ({ field }) => `${error._tag} on ${field}: ${message}`,
	});
}
