import { Schema } from "effect";

export class DuplicateModuleQueue extends Schema.TaggedError<DuplicateModuleQueue>()("DuplicateModuleQueue", {
	firstModule: Schema.String,
	queue: Schema.String,
	secondModule: Schema.String,
}) {
	override get message() {
		return `Queue "${this.queue}" is declared by both "${this.firstModule}" and "${this.secondModule}".`;
	}
}
