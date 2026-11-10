import { Schema } from "effect";

export class HandWrittenModuleHandlers extends Schema.TaggedError<HandWrittenModuleHandlers>()("HandWrittenModuleHandlers", {
	module: Schema.String,
	queries: Schema.Array(Schema.String),
}) {
	override get message() {
		return `Module "${this.module}" serves ${this.queries.join(", ")} through hand-written handlers instead of its generated ones, which check each query's read policy with the module's services. Register it as \`module:\` instead of \`group\` and \`handlers\`.`;
	}
}
