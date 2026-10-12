import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

const buttonVariants = cva(
	"inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-4 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
	{
		defaultVariants: { variant: "default" },
		variants: {
			variant: { default: "bg-primary text-primary-foreground hover:bg-primary/90", outline: "border border-input bg-background hover:bg-muted" },
		},
	},
);

export function Button({ className, variant, type = "button", ...props }: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
	return <button className={cn(buttonVariants({ variant }), className)} type={type} {...props} />;
}
