import { Clock, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";

export function liveBoard(root: string) {
	return markdownBoard(root).pipe(Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())));
}
