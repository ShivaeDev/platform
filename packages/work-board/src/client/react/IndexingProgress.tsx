import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/reactivity/Atom";
import { useContext } from "react";
import { Progress, ProgressLabel } from "#client/react/components/ui/progress.tsx";
import type { Indexing } from "#rpc/Indexing.ts";
import { SessionContext } from "./SessionContext.ts";

const count = new Intl.NumberFormat("en-US");

export function IndexingProgress() {
	const client = useContext(SessionContext);
	return client ? <IndexingBar indexing={client.indexing} /> : null;
}

export function IndexingBar({ indexing }: { readonly indexing: Atom.Atom<Indexing | undefined> }) {
	const value = useAtomValue(indexing);
	if (value === undefined) {
		return null;
	}
	const { read, total } = value;
	return (
		<Progress
			className="max-w-md text-muted-foreground **:data-[slot=progress-indicator]:bg-muted-foreground"
			data-indexing
			value={total === undefined || total === 0 ? null : (read / total) * 100}
		>
			<ProgressLabel className="font-normal text-sm">
				{total === undefined ? "Reading the workspace…" : `Reading ${count.format(read)} of ${count.format(total)} files…`}
			</ProgressLabel>
		</Progress>
	);
}
