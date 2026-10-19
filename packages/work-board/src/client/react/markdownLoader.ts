export type MarkdownRenderers = typeof import("./markdownRenderers.ts").markdownRenderers;
export type MarkdownLoad = MarkdownRenderers | { readonly error: string };

let loaded: MarkdownRenderers | undefined;
let loading: Promise<MarkdownLoad> | undefined;

export function loadedMarkdownRenderers() {
	return loaded;
}

// A failed chunk stays failed until the reader reloads, so every Markdown view reports it once instead of refetching on each render.
export function loadMarkdownRenderers() {
	loading ??= import("./markdownRenderers.ts").then(
		({ markdownRenderers }) => {
			loaded = markdownRenderers;
			return markdownRenderers;
		},
		(error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }),
	);
	return loading;
}
