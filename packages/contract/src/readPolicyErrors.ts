import { Schema } from "effect";

export class MissingReadPolicy extends Schema.TaggedError<MissingReadPolicy>()("MissingReadPolicy", { message: Schema.String }) {}
export class QueryReadDenied extends Schema.TaggedError<QueryReadDenied>()("QueryReadDenied", { message: Schema.String }) {}
