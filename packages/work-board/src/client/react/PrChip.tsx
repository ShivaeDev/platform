import { GitPullRequest } from "lucide-react";
import { Badge } from "#client/react/components/ui/badge.tsx";

export function PrChip({ url }: { readonly url: string | undefined }) {
	return url ? (
		<Badge render={<a href={url} />} variant="outline">
			<GitPullRequest aria-hidden="true" />
			PR
		</Badge>
	) : null;
}
