import type { ComponentProps, ReactNode } from "react";

export interface PageHeaderProps extends Omit<ComponentProps<"header">, "title"> {
	readonly actions?: ReactNode;
	readonly summary?: ReactNode;
	readonly title: ReactNode;
	readonly titleProps?: Omit<ComponentProps<"h1">, "children">;
}

export function PageHeader({ title, titleProps, summary, actions, className, ...props }: PageHeaderProps) {
	return (
		<header
			className={classes("grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]", className)}
			data-page-header
			{...props}
		>
			<h1 {...titleProps} className={classes("m-0 font-semibold text-2xl leading-tight [overflow-wrap:anywhere]", titleProps?.className)}>
				{title}
			</h1>
			{present(summary) && (
				<div className="min-w-0 text-muted-foreground text-sm sm:col-span-full sm:row-start-2" data-page-summary>
					{summary}
				</div>
			)}
			{present(actions) && (
				<div className="flex flex-wrap items-center gap-2 sm:col-start-2 sm:row-start-1 sm:justify-end" data-page-actions>
					{actions}
				</div>
			)}
		</header>
	);
}

function present(node: ReactNode) {
	return node !== undefined && node !== null && node !== false && node !== "";
}

function classes(base: string, extra: string | undefined) {
	return extra ? `${base} ${extra}` : base;
}
