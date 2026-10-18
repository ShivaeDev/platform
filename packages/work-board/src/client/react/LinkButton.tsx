import type { ReactNode } from "react";
import { Button } from "#client/react/components/ui/button.tsx";

export function LinkButton({ href, children }: { readonly href: string; readonly children: ReactNode }) {
	return (
		<Button nativeButton={false} render={<a href={href} />} size="sm" variant="outline">
			{children}
		</Button>
	);
}
