import { Schema } from "effect";

export class RenderFailed extends Schema.TaggedError<RenderFailed>()("RenderFailed", { cause: Schema.Unknown }) {
	override get message() {
		return "The document could not be rendered. Check the Markdown source and retry; restart Work Board if rendering still fails.";
	}
}
