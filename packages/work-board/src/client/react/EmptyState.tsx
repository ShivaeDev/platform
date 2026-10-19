import { cn } from "cn";
import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "#client/react/components/ui/empty.tsx";

export function EmptyState({
	action,
	children,
	className,
	compact = false,
	title,
}: {
	readonly action?: ReactNode;
	readonly children: ReactNode;
	readonly className?: string;
	readonly compact?: boolean;
	readonly title: string;
}) {
	return (
		<Empty className={cn(compact ? "items-start gap-2 p-2 text-left" : "border", className)}>
			<EmptyHeader className={compact ? "items-start" : undefined}>
				<EmptyTitle className={compact ? "text-xs" : undefined}>{title}</EmptyTitle>
				<EmptyDescription>{children}</EmptyDescription>
			</EmptyHeader>
			{action ? <EmptyContent className={compact ? "items-start" : undefined}>{action}</EmptyContent> : null}
		</Empty>
	);
}
