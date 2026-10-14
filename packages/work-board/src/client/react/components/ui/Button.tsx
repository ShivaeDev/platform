import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "#client/react/lib/cn.ts";
import { buttonVariants } from "./buttonVariants.ts";

export function Button({ className, variant, size, type = "button", ...props }: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
	return <button className={cn(buttonVariants({ size, variant }), className)} type={type} {...props} />;
}
