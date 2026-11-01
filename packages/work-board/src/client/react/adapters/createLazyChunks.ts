import { errorMessage } from "#errorMessage.ts";
import { chunkImports } from "./chunkImports.ts";

type ChunkLoad<T> = T | { readonly error: string };

// A failed chunk stays failed until the reader reloads, rather than refetching on every render.
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

export function createLazyChunks() {
	return {
		goalChart: lazyChunk(() => chunkImports.goalChart()),
		markdown: lazyChunk(() => chunkImports.markdown()),
		searchPalette: lazyChunk(() => chunkImports.searchPalette()),
		workTable: lazyChunk(() => chunkImports.workTable()),
	};
}
