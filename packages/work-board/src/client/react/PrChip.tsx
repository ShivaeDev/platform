import { GitPullRequest } from "lucide-react";
import { Badge } from "#client/react/components/ui/Badge.tsx";

export function PrChip({ url }: { readonly url: string | undefined }) {
	return url ? (
		<a href={url}>
			<Badge variant="outline">
				<GitPullRequest aria-hidden="true" />
				PR
			</Badge>
		</a>
	) : null;
}
