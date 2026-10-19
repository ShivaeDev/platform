import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Badge } from "#client/react/components/ui/badge.tsx";

export function NeedsYouBadge({
	count,
	...props
}: Omit<ComponentProps<typeof Badge>, "children" | "variant"> & { readonly count: number | null | undefined }) {
	return (
		<Badge {...props} variant={count ? "default" : "secondary"}>
			{count === undefined ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : (count ?? "?")}
		</Badge>
	);
}
