import type { ComponentProps } from "react";
import { cn } from "#client/react/lib/cn.ts";
export function Card({ className, ...props }: ComponentProps<"article">) {
	return <article className={cn("rounded-lg border bg-card p-4 text-card-foreground shadow-sm", className)} {...props} />;
}
