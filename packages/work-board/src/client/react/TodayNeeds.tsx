import type { ReactNode } from "react";
import type { InboxProjection } from "#browser/views/schema.ts";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { Age } from "./Age.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { TodayOptions } from "./TodayOptions.tsx";

type Item = InboxProjection["you"][number];
export function TodayNeeds({ api, data }: { readonly api: ShellApi; readonly data: InboxProjection }) {
	if (!data.complete) {
		return <p role="status">Workspace incomplete. Needs-you membership and counts are unavailable.</p>;
	}
	return data.you.length > 0 ? (
		<ul aria-label="Needs you" className="m-0 list-none divide-y rounded-lg border border-border p-0">
			{data.you.map((item) => (
				<li className="h-12 max-h-12" data-attention-id={item.id} key={`${item.file}:${item.href}`}>
					<TodayRow item={item} status="needs-you">
						<TodayOptions api={api} item={item} />
					</TodayRow>
				</li>
			))}
		</ul>
	) : (
		<p className="text-muted-foreground text-sm">All quiet — nothing needs you.</p>
	);
}

export function TodayLater({ items }: { readonly items: readonly Item[] }) {
	return (
		<ul aria-label="Later" className="m-0 list-none divide-y rounded-lg border border-border p-0">
			{items.map((item) => (
				<li className="h-12 max-h-12" key={item.file}>
					<TodayRow item={item} status="deferred" />
				</li>
			))}
		</ul>
	);
}

function TodayRow({ children, item, status }: { readonly children?: ReactNode; readonly item: Item; readonly status: "deferred" | "needs-you" }) {
	return (
		<div className="today-row flex h-full min-w-0 items-center gap-2 px-2" data-attention-row={status === "needs-you" ? "" : undefined}>
			<StatusChip
				aria-label={status === "needs-you" ? "Needs you" : "Deferred"}
				className="shrink-0 max-sm:size-6 max-sm:justify-center max-sm:gap-0 max-sm:px-1 max-sm:text-[0px] max-sm:[&_svg]:shrink-0"
				status={status}
			/>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-baseline gap-2">
					<a className="truncate font-medium text-sm" href={item.href} title={item.title}>
						{item.title}
					</a>
					<span className="shrink-0 font-mono text-[10px] text-muted-foreground max-sm:hidden">{item.id}</span>
				</div>
				<p className="m-0 truncate text-muted-foreground text-xs" title={item.problem ?? item.reason}>
					<span className="inline-block max-w-24 truncate align-bottom font-mono text-[10px] sm:hidden" title={item.id}>
						{item.id}
					</span>
					<span className="sm:hidden"> · </span>
					{item.problem ?? item.reason}
				</p>
			</div>
			<span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
				{item.modified === undefined ? "Age ?" : <Age modified={item.modified} short />}
			</span>
			{children}
		</div>
	);
}
