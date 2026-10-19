import type { ComponentProps } from "react";
import { Badge } from "#client/react/components/ui/badge.tsx";

export function NeedsYouBadge({ count, ...props }: Omit<ComponentProps<typeof Badge>, "children" | "variant"> & { readonly count: number | null }) {
	return (
		<Badge {...props} variant={count ? "default" : "secondary"}>
			{count ?? "?"}
		</Badge>
	);
}
