import type { KeyboardEvent } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { LoadingRows } from "#client/react/loading.tsx";

export function SearchOutcome({
	failed,
	found,
	input,
	onIncludeRecords,
	onKeyDown,
	text,
	waiting,
}: {
	readonly failed: boolean;
	readonly found: number;
	readonly input: string;
	readonly onIncludeRecords: (() => void) | undefined;
	readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
	readonly text: string;
	readonly waiting: boolean;
}) {
	if (found > 0 || failed || (waiting ? input.trim() === "" : text === "")) {
		return null;
	}
	const action = onIncludeRecords && (
		<Button onClick={onIncludeRecords} onKeyDown={onKeyDown} size="xs" variant="outline">
			Include files Fleet writes
		</Button>
	);
	return (
		<div className="px-3 pb-3">
			{waiting ? (
				<LoadingRows framed={false} label="Searching" />
			) : (
				<EmptyState action={action} title="No matches">
					Nothing in this workspace matches “{text}”. Try fewer or different words.
				</EmptyState>
			)}
		</div>
	);
}
