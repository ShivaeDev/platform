import type { Document } from "#browser/document/schema.ts";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
export function Reference({ document, target }: { readonly document: Document; readonly target: string }) {
	const details = document.referenceDetails?.[target];
	const href = document.references[target];
	return href ? (
		<span className="inline-flex flex-wrap items-center gap-2">
			<a href={href}>{details?.title ?? <code>{target}</code>}</a>
			{details !== undefined && <StatusChip status={details.status} />}
			{target.includes("#") && <code>#{target.split("#")[1]}</code>}
		</span>
	) : (
		<span>
			<code>{target}</code> (unresolved, ambiguous, or unavailable)
		</span>
	);
}
