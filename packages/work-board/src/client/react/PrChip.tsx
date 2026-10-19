import { GitPullRequest } from "lucide-react";
import { Badge } from "#client/react/components/ui/badge.tsx";

export function PrChip({ className, url }: { readonly className?: string; readonly url: string | undefined }) {
	return url ? (
		<Badge className={className} render={<a href={url} />} variant="outline">
			<GitPullRequest aria-hidden="true" />
			PR
		</Badge>
	) : null;
}
