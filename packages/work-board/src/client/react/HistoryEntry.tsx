import { X } from "lucide-react";
import type { LibraryFile } from "#browser/navigation/library.ts";
import { kindLabel } from "#browser/views/statusLabel.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import type { Item } from "#client/react/LibraryContext.ts";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { fileUrl } from "#files/url.ts";
import { RowTime } from "./Time.tsx";

export interface Entry {
	readonly current: boolean;
	readonly file: LibraryFile | undefined;
	readonly item: Item;
	readonly missing: boolean;
}

function EntryDetails({ entry }: { readonly entry: Entry }) {
	const kind = entry.file ? kindLabel(entry.file.kind) : undefined;
	if (entry.item.at === undefined && kind === undefined) {
		return null;
	}
	return (
		<span className="text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
			{entry.item.at === undefined ? null : (
				<span>
					read <RowTime at={entry.item.at} />
				</span>
			)}
			{entry.item.at !== undefined && kind !== undefined ? <span aria-hidden="true">·</span> : null}
			{kind === undefined ? null : <span>{kind}</span>}
			{entry.file?.status ? (
				<>
					<span aria-hidden="true">·</span>
					<StatusChip status={entry.file.status} />
				</>
			) : null}
		</span>
	);
}

export function HistoryEntry({
	entry,
	onClose,
	onRemove,
}: {
	readonly entry: Entry;
	readonly onClose: () => void;
	readonly onRemove?: (() => void) | undefined;
}) {
	return (
		<li className="flex min-w-0 items-center gap-1">
			<div className="hover:bg-muted has-[a[aria-current=page]]:bg-accent has-[a[aria-current=page]]:text-accent-foreground has-[a:focus-visible]:ring-ring/50 relative min-w-0 flex-1 rounded-md px-2 py-1.5 has-[a:focus-visible]:ring-3">
				<a
					aria-current={entry.current ? "page" : undefined}
					className="text-foreground aria-[current=page]:text-accent-foreground block truncate no-underline outline-none after:absolute after:inset-0"
					href={fileUrl(entry.item.file)}
					onClick={onClose}
					title={entry.item.title}
				>
					{entry.item.title}
					{entry.missing ? <span className="text-muted-foreground"> (missing)</span> : ""}
				</a>
				<EntryDetails entry={entry} />
			</div>
			{onRemove ? (
				<Button
					aria-label={`Remove ${entry.item.title} from history`}
					className="pointer-coarse:size-11"
					data-history-remove
					onClick={onRemove}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<X aria-hidden="true" />
				</Button>
			) : null}
		</li>
	);
}
