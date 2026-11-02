import { Effect } from "effect";
import type { documentHeadings } from "#render/documentHeadings.ts";
import { Highlighter } from "./Highlighter.ts";

export interface RenderOptions {
	readonly file?: string;
	readonly headings?: ReturnType<typeof documentHeadings>;
	readonly idPrefix?: string;
	readonly questionActions?: ReadonlyMap<string, string>;
	readonly safe?: boolean;
}

export const renderMarkdown = Effect.fn("WorkBoard.renderMarkdown")(function* (source: string, options: RenderOptions = {}) {
	return yield* (yield* Highlighter).markdown(source, options);
});
