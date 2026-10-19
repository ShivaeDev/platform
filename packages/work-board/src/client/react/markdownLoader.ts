export type MarkdownRenderers = typeof import("./markdownRenderers.ts").markdownRenderers;

let loaded: MarkdownRenderers | undefined;
let loading: Promise<MarkdownRenderers> | undefined;

export function loadedMarkdownRenderers() {
	return loaded;
}

export function loadMarkdownRenderers() {
	loading ??= import("./markdownRenderers.ts").then(
		({ markdownRenderers }) => {
			loaded = markdownRenderers;
			return markdownRenderers;
		},
		(error: unknown) => {
			loading = undefined;
			throw error;
		},
	);
	return loading;
}
