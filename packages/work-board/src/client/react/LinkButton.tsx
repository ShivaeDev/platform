import type { ReactNode } from "react";
import { buttonVariants } from "#client/react/components/ui/button.tsx";

export function LinkButton({ href, children }: { readonly href: string; readonly children: ReactNode }) {
	return (
		<a className={buttonVariants({ size: "sm", variant: "outline" })} data-slot="link-button" href={href}>
			{children}
		</a>
	);
}
