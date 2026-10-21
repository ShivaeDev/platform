import { Schema } from "effect";
import {
	BadRequest,
	Conflict,
	Forbidden,
	InternalServerError,
	NotFound,
	PreconditionFailed,
	ServiceUnavailable,
} from "@shivaedev/platform/errors/taxonomy.ts";

export class PublicationUncertain extends Schema.TaggedError<PublicationUncertain>()("PublicationUncertain", { message: Schema.String }) {}
export class Unanswered extends Schema.TaggedError<Unanswered>()("Unanswered", { message: Schema.String }) {}

export const responseRejections = {
	BadRequest,
	Conflict,
	Forbidden,
	InternalServerError,
	NotFound,
	PreconditionFailed,
	PublicationUncertain,
	ServiceUnavailable,
	Unanswered,
};
export const ResponseRejection = Schema.Union(Object.values(responseRejections));
export type ResponseRejection = typeof ResponseRejection.Type;

export const documentRejections = { BadRequest, Conflict, InternalServerError, NotFound, ServiceUnavailable };
export const DocumentRejection = Schema.Union(Object.values(documentRejections));
