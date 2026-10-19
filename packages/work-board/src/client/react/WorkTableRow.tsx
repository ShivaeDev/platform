import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { sameStatus } from "#browser/views/statusLabel.ts";
import { TableCell, TableHead, TableRow } from "#client/react/components/ui/table.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { WorkItemTitle } from "./WorkItemTitle.tsx";

export function WorkTableRow({
	item,
	state,
	height,
}: {
	readonly item: WorkProjection["rows"][number];
	readonly state: State;
	readonly height: number | undefined;
}) {
	const selected = item.id === state.item;
	const status = item.metadata.status;
	return (
		<TableRow
			className="relative align-top has-[a:focus-visible]:bg-muted/50"
			data-item={item.id}
			data-selected={selected ? "true" : undefined}
			data-state={selected ? "selected" : undefined}
			style={height === undefined ? undefined : { height }}
		>
			<TableHead className="h-auto whitespace-normal py-2.5 font-normal" scope="row">
				<WorkItemTitle
					className="font-medium text-foreground no-underline after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
					item={item}
					state={state}
				/>
				<span className="block break-all font-mono text-muted-foreground text-xs">{item.id}</span>
				{Boolean(item.metadata.nextAction) && <span className="mt-1 block text-muted-foreground text-xs md:hidden">{item.metadata.nextAction}</span>}
			</TableHead>
			<TableCell className="whitespace-normal py-2.5 text-muted-foreground max-md:hidden">{item.metadata.kind ?? ""}</TableCell>
			<TableCell className="whitespace-normal py-2.5">
				<div className="flex flex-wrap gap-1">
					{Boolean(item.waiting) && !(status && sameStatus(status, "needs-you")) && <StatusChip status="needs-you" />}
					<StatusChip status={status} />
				</div>
			</TableCell>
			<TableCell className="whitespace-normal break-words py-2.5 max-md:hidden">{item.metadata.owner ?? ""}</TableCell>
			<TableCell className="whitespace-normal py-2.5 text-muted-foreground max-md:hidden">{item.metadata.nextAction ?? ""}</TableCell>
		</TableRow>
	);
}
