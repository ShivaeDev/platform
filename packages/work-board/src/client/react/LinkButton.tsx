import { cn } from "cn";
import type { ReactNode } from "react";
import { buttonVariants } from "#client/react/components/ui/button.tsx";

export function LinkButton({
	href,
	children,
	variant = "outline",
}: {
	readonly href: string;
	readonly children: ReactNode;
	readonly variant?: "default" | "outline";
}) {
	return (
		<a className={cn(buttonVariants({ size: "sm", variant }))} data-slot="link-button" href={href}>
			{children}
		</a>
	);
}
