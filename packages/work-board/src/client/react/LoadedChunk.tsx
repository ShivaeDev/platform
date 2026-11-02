import { type ReactNode, use } from "react";
import type { ChunkLoad } from "#client/react/adapters/createLazyChunks.ts";

interface Props<T> {
	readonly children: (value: ChunkLoad<T>) => ReactNode;
	readonly chunk: {
		readonly load: () => Promise<ChunkLoad<T>>;
		readonly loaded: () => T | undefined;
	};
}

// A separate pending component keeps its use call consistent while cached chunks render synchronously for dialog focus.
export function LoadedChunk<T>(props: Props<T>) {
	const loaded = props.chunk.loaded();
	if (loaded !== undefined) {
		return props.children(loaded);
	}
	return <PendingChunk {...props} />;
}

function PendingChunk<T>({ children, chunk }: Props<T>) {
	return children(use(chunk.load()));
}
