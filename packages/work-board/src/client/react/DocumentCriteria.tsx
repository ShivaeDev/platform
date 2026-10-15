import type { Document } from "#browser/document/schema.ts";
import { keyed } from "./keyed.ts";
export function DocumentCriteria({ document }: { readonly document: Document }) {
	const criteria = document.metadata.criteria ?? [];
	if (criteria.length === 0) {
		return null;
	}
	const valid = Boolean(document.identity) && document.unavailable.length === 0;
	function unique(id: string) {
		return criteria.filter((entry) => entry.id === id).length === 1;
	}
	const evidenced = criteria.filter((entry) => valid && unique(entry.id) && (document.reading?.claims[entry.id]?.length ?? 0) > 0).length;
	return (
		<>
			<h3>Criteria and recorded evidence</h3>
			<p className="text-muted-foreground text-xs">
				{evidenced} of {criteria.length} criteria have recorded evidence
			</p>
			{(!valid || criteria.some((entry) => !unique(entry.id))) && (
				<p>Evidence association requires unique item/criterion IDs and a readable workspace.</p>
			)}
			<ul>
				{keyed(criteria, (entry) => entry.id).map(({ index, key }) => (
					<Criterion document={document} index={index} key={key} />
				))}
			</ul>
		</>
	);
}
function Criterion({ document, index }: { readonly document: Document; readonly index: number }) {
	const criterion = document.metadata.criteria?.[index];
	if (!criterion) {
		return null;
	}
	const unique = document.metadata.criteria?.filter((entry) => entry.id === criterion.id).length === 1;
	return (
		<li id={unique ? `criterion-${criterion.id}` : undefined} tabIndex={-1}>
			<code>{criterion.id}</code>: {criterion.text}
			<CriterionClaims document={document} id={criterion.id} valid={Boolean(document.identity) && document.unavailable.length === 0 && unique} />
		</li>
	);
}
export function CriterionClaims({ document, id, valid }: { readonly document: Document; readonly id: string; readonly valid: boolean }) {
	const claims = document.reading?.claims[id] ?? [];
	if (!valid || claims.length === 0) {
		return null;
	}
	return (
		<>
			<p>
				{claims.length} recorded {claims.length === 1 ? "claim" : "claims"}, not verified acceptance:
			</p>
			<ul>
				{keyed(claims, (claim) => `${claim.href}:${claim.label}`).map(({ key, value: claim }) => (
					<li key={key}>
						<a href={claim.href}>{claim.label} — open recorded evidence</a>
					</li>
				))}
			</ul>
		</>
	);
}
