import type { ReactNode } from "react";

export function ViewStatus({ children }: { readonly children: ReactNode }) {
	return (
		<p className="empty text-muted-foreground text-sm" role="status">
			{children}
		</p>
	);
}
