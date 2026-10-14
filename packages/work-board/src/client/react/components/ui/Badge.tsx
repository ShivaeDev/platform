import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "#client/react/lib/cn.ts";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium text-xs [&_svg]:size-3.5", {
	defaultVariants: { variant: "default" },
	variants: { variant: { default: "border-transparent bg-secondary text-secondary-foreground", outline: "border-border text-foreground" } },
});
export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
