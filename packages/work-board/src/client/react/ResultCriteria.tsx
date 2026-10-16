import { Fragment, type ReactNode } from "react";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { keyed } from "./keyed.ts";
import { shellIds } from "./shellIds.ts";

type Target = ResultProjection["targets"][number];
type Criterion = Target["criteria"][number];
type Claim = Criterion["claims"][number];
export function ResultCriteria({ data }: { readonly data: ResultProjection }) {
	const targets = data.targets.map((target) => <TargetRow key={target.link.label} target={target} />);
	return (
		<section id={shellIds.resultCriteria}>
			<h2 title="Only explicit relationships and criterion references are associated. Git revisions are authored records; Work Board does not compare them with the current checkout. Evidence freshness is unknown. This result does not change the linked work’s status.">
				Criteria and this result’s claims
			</h2>
			{targets.length > 0 ? <ul>{targets}</ul> : <p>No explicitly linked work or criteria.</p>}
		</section>
	);
}
function TargetRow({ target }: { readonly target: Target }) {
	const criteria = keyed(target.criteria, (entry) => entry.link.label).map(({ key, value }) => <CriterionRow criterion={value} key={key} />);
	return (
		<li>
			<a href={target.link.href}>{target.link.label}</a>
			{target.available ? (
				<>
					{Boolean(target.status) && <span> · source status: {target.status}</span>}
					{criteria.length > 0 ? <ul>{criteria}</ul> : <p>No criteria declared in this source.</p>}
				</>
			) : (
				" — criteria unavailable."
			)}
		</li>
	);
}
function CriterionRow({ criterion }: { readonly criterion: Criterion }) {
	let evidence: ReactNode = null;
	if (!criterion.link.href) {
		evidence = <p>This criterion identity is ambiguous; evidence association unavailable.</p>;
	} else if (criterion.claims.length > 0) {
		const claims = keyed(criterion.claims, (entry) => entry.source.label).map(({ key, value }) => <ClaimRow claim={value} key={key} />);
		evidence = (
			<>
				<p title="Recorded claims do not establish verified acceptance.">
					{criterion.claims.length} recorded {criterion.claims.length === 1 ? "claim" : "claims"}
				</p>
				<ul>{claims}</ul>
			</>
		);
	}
	return (
		<li>
			<a href={criterion.link.href}>{criterion.text}</a>
			{evidence}
		</li>
	);
}
function ClaimRow({ claim }: { readonly claim: Claim }) {
	const details = [
		["Checked Git revision (reported)", claim.checkedRevision],
		["Method", claim.method],
		["Outcome (reported)", claim.outcome],
		["Observed time", claim.observedAt],
	].map(([label, value]) => (
		<Fragment key={label}>
			<dt>{label}</dt>
			<dd>{value ?? ""}</dd>
		</Fragment>
	));
	return (
		<li>
			<a href={claim.source.href}>{claim.source.label}</a>
			{claim.problem}
			<dl>{details}</dl>
		</li>
	);
}
