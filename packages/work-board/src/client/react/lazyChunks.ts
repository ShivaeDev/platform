import { errorMessage } from "#errorMessage.ts";

export type MarkdownRenderers = typeof import("./markdownRenderers.ts").markdownRenderers;
export type ChunkLoad<T> = T | { readonly error: string };

// A failed chunk stays failed until the reader reloads, so every view of it reports the failure once instead of refetching on each render.
function lazyChunk<T>(load: () => Promise<T>) {
	let loaded: T | undefined;
	let loading: Promise<ChunkLoad<T>> | undefined;
	return {
		load: () => {
			loading ??= load().then(
				(module) => {
					loaded = module;
					return module;
				},
				(error: unknown) => ({ error: errorMessage(error) }),
			);
			return loading;
		},
		loaded: () => loaded,
	};
}

export const markdownChunk = lazyChunk(() => import("./markdownRenderers.ts").then(({ markdownRenderers }) => markdownRenderers));
export const goalChartChunk = lazyChunk(() => import("./GoalChart.tsx"));
export const searchPaletteChunk = lazyChunk(() => import("./SearchPalette.tsx"));
export const workTableChunk = lazyChunk(() => import("./WorkTable.tsx"));

export function loadLazyChunks() {
	return Promise.all([markdownChunk.load(), goalChartChunk.load(), searchPaletteChunk.load(), workTableChunk.load()]);
}
