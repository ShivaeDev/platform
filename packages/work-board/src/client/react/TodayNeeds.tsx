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
				<li data-attention-id={item.id} key={`${item.file}:${item.href}`}>
					<TodayRow item={item} />
					{!item.problem && <TodayOptions api={api} item={item} />}
				</li>
			))}
		</ul>
	) : (
		<p className="text-muted-foreground text-sm">All quiet — nothing needs you.</p>
	);
}

export function TodayGroup({ items, title }: { readonly items: readonly Item[]; readonly title: string }) {
	return (
		<details className="today-group mt-3 rounded-lg border border-border px-3 py-2">
			<summary className="cursor-pointer text-muted-foreground text-sm">
				{title} ({items.length})
			</summary>
			<ul className="m-0 list-none divide-y p-0">
				{items.map((item) => (
					<li className="py-2 text-sm" key={`${item.file}:${item.href}`}>
						<a href={item.href}>{item.title}</a>
						<p className="m-0 text-muted-foreground text-xs">{item.reason}</p>
						{item.responseFrom !== undefined && (
							<p className="m-0 text-muted-foreground text-xs">Response needed from: {item.responseFrom.join(", ")}</p>
						)}
					</li>
				))}
			</ul>
		</details>
	);
}

function TodayRow({ item }: { readonly item: Item }) {
	return (
		<div className="today-row flex h-12 max-h-12 min-w-0 items-center gap-2 px-2" data-attention-row>
			<StatusChip
				aria-label="Needs you"
				className="shrink-0 max-sm:size-6 max-sm:justify-center max-sm:gap-0 max-sm:px-1 max-sm:text-[0px] max-sm:[&_svg]:shrink-0"
				status="needs-you"
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
			<a aria-label={`Answer ${item.title}`} className="shrink-0 text-xs" href={item.href}>
				Answer
			</a>
		</div>
	);
}
