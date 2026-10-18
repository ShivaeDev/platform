import type { ReactNode } from "react";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { answeredCopy } from "#client/responses/answeredCopy.ts";
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
					<TodayRow attention item={item}>
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
					<TodayRow item={item} />
				</li>
			))}
		</ul>
	);
}

export function TodayAnswered({ fleet, items }: { readonly fleet: FleetItemsProjection | undefined; readonly items: readonly Item[] }) {
	return (
		<ul aria-label="Answered, waiting for Fleet" className="m-0 list-none divide-y rounded-lg border border-border p-0">
			{items.map((item) => (
				<li className="h-12 max-h-12" data-answered-id={item.id} key={`${item.file}:${item.href}`}>
					<TodayRow detail={item.answered && answeredCopy(item.answered, fleet)} item={item} />
				</li>
			))}
		</ul>
	);
}

function TodayRow({
	attention = false,
	children,
	detail,
	item,
}: {
	readonly attention?: boolean;
	readonly children?: ReactNode;
	readonly detail?: string | undefined;
	readonly item: Item;
}) {
	const text = detail ?? item.problem ?? item.reason;
	return (
		<div className="today-row flex h-full min-w-0 items-center gap-2 px-2" data-attention-row={attention ? "" : undefined}>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-baseline gap-2">
					<a className="truncate font-medium text-sm" href={item.href} title={item.title}>
						{item.title}
					</a>
					<span className="shrink-0 font-mono text-[10px] text-muted-foreground max-sm:hidden">{item.id}</span>
				</div>
				<p className="m-0 truncate text-muted-foreground text-xs" title={text}>
					<span className="inline-block max-w-24 truncate align-bottom font-mono text-[10px] sm:hidden" title={item.id}>
						{item.id}
					</span>
					<span className="sm:hidden"> · </span>
					{text}
				</p>
			</div>
			<span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
				{item.modified === undefined ? "Age ?" : <Age modified={item.modified} short />}
			</span>
			{children}
		</div>
	);
}
