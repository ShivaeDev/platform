import { Fragment } from "react";
import type { Document } from "#browser/document/schema.ts";
import { keyed } from "./keyed.ts";
import { Reference } from "./Reference.tsx";
export function DocumentClaims({ document }: { readonly document: Document }) {
	const evidence = document.metadata.evidence ?? [];
	if (evidence.length === 0) {
		return null;
	}
	return (
		<>
			<h3>Recorded evidence</h3>
			<p>
				Source claims — not independently verified. A recorded outcome does not establish human acceptance. Work Board does not check recorded
				revisions against the current workspace.
			</p>
			<ul>
				{keyed(evidence, (entry) => entry.source).map(({ index, key }) => (
					<Claim document={document} index={index} key={key} />
				))}
			</ul>
		</>
	);
}
function Claim({ document, index }: { readonly document: Document; readonly index: number }) {
	const entry = document.metadata.evidence?.[index];
	if (!entry) {
		return null;
	}
	const source = document.reading?.evidenceSources[index];
	const details = [
		["Checked revision", entry.checkedRevision],
		["Observed time", entry.observedAt],
		["Method", entry.method],
		["Recorded outcome", entry.outcome],
	].map(([label, value]) => (
		<Fragment key={label}>
			<dt>{label}</dt>
			<dd>{label === "Checked revision" ? <code>{value ?? "Not recorded"}</code> : (value ?? "Not recorded")}</dd>
		</Fragment>
	));
	return (
		<li id={`recorded-evidence-${index}`} tabIndex={-1}>
			{source?.href ? (
				<a href={source.href} rel="noreferrer">
					<code>{entry.source}</code>
				</a>
			) : (
				<code>{entry.source}</code>
			)}
			{source?.problem}
			<dl>
				<dt>Recorded in</dt>
				<dd>
					<code>
						{document.file}:{document.reading?.lines[`evidence.${index}.source`] ?? document.reading?.lines.evidence ?? 1}
					</code>
				</dd>
				<dt>Criterion</dt>
				<dd>{entry.criterion ? <Reference document={document} target={entry.criterion} /> : "Not recorded"}</dd>
				{details}
			</dl>
		</li>
	);
}
