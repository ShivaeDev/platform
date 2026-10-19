import { cn } from "cn";
import type { ReactNode } from "react";
import { Skeleton } from "#client/react/components/ui/skeleton.tsx";
import { SkeletonCards, SkeletonRows } from "./skeletons.tsx";

export function Loading({
	children,
	className,
	inline = false,
	label,
}: {
	readonly children: ReactNode;
	readonly className?: string;
	readonly inline?: boolean;
	readonly label: string;
}) {
	return (
		<div aria-busy="true" className={inline ? "inline-flex items-center" : "min-w-0"} data-loading="" role="status">
			<span className="sr-only">{label}</span>
			<div aria-hidden="true" className={className}>
				{children}
			</div>
		</div>
	);
}

export function LoadingRows({ framed = true, label, rows = 3 }: { readonly framed?: boolean; readonly label: string; readonly rows?: number }) {
	return (
		<Loading label={label}>
			<SkeletonRows framed={framed} rows={rows} />
		</Loading>
	);
}

export function LoadingCards({ cards = 2, columns, label }: { readonly cards?: number; readonly columns?: 1 | 2; readonly label: string }) {
	return (
		<Loading label={label}>
			<SkeletonCards cards={cards} columns={columns} />
		</Loading>
	);
}

export function LoadingText({ className, label }: { readonly className?: string; readonly label: string }) {
	return (
		<Loading inline label={label}>
			<Skeleton className={cn("h-3.5 w-20", className)} />
		</Loading>
	);
}
