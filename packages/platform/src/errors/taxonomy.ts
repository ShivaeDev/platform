import { Schema } from "effect";

const described = { message: Schema.String };
const perField = { message: Schema.String, field: Schema.optionalKey(Schema.String) };

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", described) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", described) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", described) {}

export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", perField) {}

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", perField) {}

export class PreconditionFailed extends Schema.TaggedError<PreconditionFailed>()("PreconditionFailed", described) {}

export class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()("AuthUnavailable", described) {}
