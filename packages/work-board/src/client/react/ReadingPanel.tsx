import { cn } from "cn";
import type { ComponentProps } from "react";

export function ReadingPanel({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"min-w-0 max-w-4xl space-y-6 [overflow-wrap:anywhere] [&_a:not([data-slot])]:underline [&_a:not([data-slot])]:underline-offset-4 [&_code]:font-mono",
				className,
			)}
			{...props}
		/>
	);
}
