import { cn } from "cn";
import type { ReactNode } from "react";
import { Skeleton } from "#client/react/components/ui/skeleton.tsx";

const slots = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"] as const;

function times(count: number) {
	return slots.slice(0, count);
}

export function SkeletonSection({ children }: { readonly children: ReactNode }) {
	return (
		<div className="min-w-0 space-y-3">
			<Skeleton className="h-5 w-32" />
			{children}
		</div>
	);
}

export function SkeletonRows({ framed = true, rows }: { readonly framed?: boolean; readonly rows: number }) {
	return (
		<div className={cn("divide-y", framed && "border-border rounded-lg border")} data-loading-shape="rows">
			{times(rows).map((slot) => (
				<div className="flex h-12 items-center gap-3 px-3" key={slot}>
					<div className="min-w-0 flex-1 space-y-1.5">
						<Skeleton className="h-3.5 w-2/3" />
						<Skeleton className="h-3 w-1/3" />
					</div>
					<Skeleton className="h-3 w-12 shrink-0" />
				</div>
			))}
		</div>
	);
}

export function SkeletonCards({ cards, columns = 2 }: { readonly cards: number; readonly columns?: 1 | 2 | undefined }) {
	return (
		<div className={cn("grid min-w-0 gap-3", columns === 2 && "md:grid-cols-2")} data-loading-shape="cards">
			{times(cards).map((slot) => (
				<div className="border-border bg-card space-y-3 rounded-lg border p-4" key={slot}>
					<Skeleton className="h-4 w-1/2" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-4/5" />
					<Skeleton className="h-2 w-full" />
				</div>
			))}
		</div>
	);
}

export function SkeletonLanes() {
	return (
		<div className="grid grid-cols-[repeat(6,minmax(8.5rem,1fr))] gap-3 overflow-hidden" data-loading-shape="lanes">
			{times(6).map((slot) => (
				<div className="min-w-0 space-y-3" key={slot}>
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			))}
		</div>
	);
}

export function SkeletonTable() {
	return (
		<div className="border-border divide-y rounded-lg border" data-loading-shape="table">
			<div className="flex h-9 items-center gap-6 px-3">
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-3 w-12" />
				<Skeleton className="h-3 w-14" />
				<Skeleton className="h-3 w-12 max-sm:hidden" />
			</div>
			{times(8).map((slot) => (
				<div className="flex h-11 items-center gap-6 px-3" key={slot}>
					<Skeleton className="h-3.5 w-1/3" />
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-5 w-16 rounded-full" />
					<Skeleton className="h-3 w-1/4 max-sm:hidden" />
				</div>
			))}
		</div>
	);
}

export function SkeletonDocument() {
	return (
		<div className="max-w-[68ch] space-y-3" data-loading-shape="document">
			<Skeleton className="h-3.5 w-full" />
			<Skeleton className="h-3.5 w-11/12" />
			<Skeleton className="h-3.5 w-4/5" />
			<Skeleton className="mt-6 h-5 w-48" />
			<Skeleton className="h-3.5 w-full" />
			<Skeleton className="h-3.5 w-3/4" />
		</div>
	);
}
