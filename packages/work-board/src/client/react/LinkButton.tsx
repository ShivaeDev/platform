import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { buttonVariants } from "#client/react/components/ui/button.tsx";

export function LinkButton({
	className,
	size = "sm",
	variant = "outline",
	...props
}: ComponentProps<"a"> & VariantProps<typeof buttonVariants> & { readonly href: string }) {
	return <a className={cn(buttonVariants({ className, size, variant }))} data-slot="link-button" {...props} />;
}
