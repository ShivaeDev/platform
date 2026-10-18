import { GitPullRequest } from "lucide-react";
import { Badge } from "#client/react/components/ui/badge.tsx";

export function PrChip({ url }: { readonly url: string | undefined }) {
	return url ? (
		<Badge asChild variant="outline">
			<a href={url}>
				<GitPullRequest aria-hidden="true" />
				PR
			</a>
		</Badge>
	) : null;
}
