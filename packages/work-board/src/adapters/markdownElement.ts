import { Effect } from "effect";
import { MarkdownAsync, type Options } from "react-markdown";
import { RenderFailed } from "#render/Failed.ts";

export function markdownElement(source: string, options: Omit<Options, "children">) {
	return Effect.runPromise(
		Effect.tryPromise({
			catch: (cause) => new RenderFailed({ cause }),
			try: () => MarkdownAsync({ ...options, children: source }),
		}),
	);
}
