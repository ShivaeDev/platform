import { cn } from "cn";
import type { ReactNode } from "react";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { InboxProjection, RecentAnswer } from "#browser/views/schema.ts";
import { recentAnswerCopy } from "#client/responses/answeredCopy.ts";
import { EmptyState } from "./EmptyState.tsx";
import { LinkButton } from "./LinkButton.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { RowTime } from "./Time.tsx";
import { TodayOptions } from "./TodayOptions.tsx";
import { todayKey } from "./todayKey.ts";

type Item = InboxProjection["you"][number];

export function TodayNeeds({
	api,
	complete,
	identified,
	items,
	onSaved,
}: {
	readonly api: ShellApi;
	readonly complete: boolean;
	readonly identified: boolean;
	readonly items: readonly Item[];
	readonly onSaved: (item: Item) => void;
}) {
	if (!complete) {
		return <p role="status">Some files couldn't be read, so what needs you is unknown.</p>;
	}
	return items.length > 0 ? (
		<ul aria-label="Needs you" className="m-0 list-none divide-y rounded-lg border border-border p-0">
			{items.map((item) => (
				<li className="min-h-12 sm:h-12 sm:max-h-12" data-attention-id={item.id} key={todayKey(item)}>
					<TodayRow attention item={item}>
						<TodayOptions api={api} item={item} onSaved={() => onSaved(item)} />
					</TodayRow>
				</li>
			))}
		</ul>
	) : (
		<EmptyState action={identified ? undefined : <LinkButton href="/_board/start">Getting started</LinkButton>} title="Nothing needs you">
			Questions and reviews from your agents appear here when they need your answer.
		</EmptyState>
	);
}

export function TodayLater({ items }: { readonly items: readonly Item[] }) {
	return (
		<ul aria-label="Later" className="m-0 list-none divide-y rounded-lg border border-border p-0">
			{items.map((item) => (
				<li className="min-h-12 sm:h-12 sm:max-h-12" key={item.file}>
					<TodayRow item={item} />
				</li>
			))}
		</ul>
	);
}

export function TodayAnswered({ fleet, rows }: { readonly fleet: FleetItemsProjection | undefined; readonly rows: readonly RecentAnswer[] }) {
	return (
		<ul aria-label="Answered" className="m-0 list-none divide-y rounded-lg border border-border p-0">
			{rows.map((row) => (
				<li className="min-h-12 sm:h-12 sm:max-h-12" data-answer-state={row.state} data-answered-id={row.id} key={row.answer.response}>
					<TodayRow detail={recentAnswerCopy(row, fleet)} item={{ ...row, modified: row.answeredAt }} />
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
	readonly item: Pick<Item, "href" | "modified" | "title"> & Partial<Pick<Item, "problem" | "reason">>;
}) {
	const text = detail ?? item.problem ?? item.reason;
	return (
		<div
			className={cn(
				"today-row grid h-full min-h-12 min-w-0 content-center items-center gap-x-2 px-2 max-sm:py-1.5",
				children ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
			)}
			data-attention-row={attention ? "" : undefined}
		>
			<a className="font-medium text-sm max-sm:line-clamp-2 sm:truncate" href={item.href} title={item.title}>
				{item.title}
			</a>
			<span className="shrink-0 text-[10px] text-muted-foreground tabular-nums max-sm:self-start max-sm:leading-6 sm:row-span-2">
				{item.modified === undefined ? "Age unknown" : <RowTime at={item.modified} />}
			</span>
			{children ? <div className="max-sm:self-start sm:row-span-2">{children}</div> : null}
			<p className="col-span-full m-0 truncate text-muted-foreground text-xs sm:col-span-1 sm:col-start-1 sm:row-start-2" title={text}>
				{text}
			</p>
		</div>
	);
}
