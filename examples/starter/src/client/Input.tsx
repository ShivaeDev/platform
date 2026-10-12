import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export function Input({ className, ...props }: ComponentProps<"input">) {
	return (
		<input
			className={cn(
				"h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}
