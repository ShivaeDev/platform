import type { Document } from "#browser/document/schema.ts";
import { keyed } from "./keyed.ts";
export function DocumentCriteria({ document }: { readonly document: Document }) {
	const criteria = document.metadata.criteria ?? [];
	if (criteria.length === 0) {
		return null;
	}
	return (
		<>
			<h3>Criteria and recorded evidence</h3>
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
			<b>{criterion.id}</b>: {criterion.text}
			<Claims document={document} id={criterion.id} valid={Boolean(document.identity) && document.unavailable.length === 0 && unique} />
		</li>
	);
}
function Claims({ document, id, valid }: { readonly document: Document; readonly id: string; readonly valid: boolean }) {
	const claims = document.reading?.claims[id] ?? [];
	if (!valid) {
		return <p>Evidence association requires unique item/criterion IDs and a readable workspace. Acceptance is not established.</p>;
	}
	if (claims.length === 0) {
		return <p>No recorded evidence naming this criterion. Acceptance is not established.</p>;
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
