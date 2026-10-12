import { Fragment } from "react";
import type { Document } from "#browser/document/schema.ts";
import { DocumentEvidence } from "./DocumentEvidence.tsx";
import { DocumentRecords } from "./DocumentRecords.tsx";
import { keyed } from "./keyed.ts";
import { Reference } from "./Reference.tsx";
export function DocumentWorkMetadata({ document }: { readonly document: Document }) {
	return (
		<section aria-label="Recorded work" className="work-meta">
			<MetadataLead document={document} />
			<details data-key="work-metadata">
				<summary>Work details and source</summary>
				<DocumentRecords document={document} />
				<MetadataFields document={document} />
				<DocumentEvidence document={document} />
				<SourceInfo document={document} />
			</details>
		</section>
	);
}
function MetadataLead({ document }: { readonly document: Document }) {
	const { identity, metadata: fields } = document;
	const diagnostics = keyed(document.diagnostics, (problem) => `${problem.line}:${problem.message}`).map(({ key, value: problem }) => (
		<li key={key}>
			{document.file}:{problem.line} — {problem.message}
		</li>
	));
	return (
		<>
			<p className="metadata-summary">
				Recorded work ·{" "}
				{identity ? <a href={`/_board/item/${encodeURIComponent(identity)}/`}>Item link: {identity}</a> : `ID: ${fields.id ?? "Not recorded"}`}
			</p>
			{identity !== undefined && fields.kind === "board" && (
				<p>
					<a href={`/_board/work?view=board&board=${encodeURIComponent(identity)}`}>View this board</a>
				</p>
			)}
			{identity !== undefined && fields.kind === "result" && (
				<p>
					<a href={`/_board/result?item=${encodeURIComponent(identity)}`}>Review returned result</a>
				</p>
			)}
			{identity !== undefined && !["question", "response", "handoff"].includes(fields.kind ?? "") && (
				<p>
					<a href={`/_board/handoff?item=${encodeURIComponent(identity)}`}>Prepare an agent handoff</a>
				</p>
			)}
			{diagnostics.length > 0 && (
				<div className="metadata-problems" role="status">
					<b>Source diagnostics</b>
					<ul>{diagnostics}</ul>
				</div>
			)}
		</>
	);
}
function MetadataFields({ document }: { readonly document: Document }) {
	const fields = document.metadata;
	const values = [
		["Kind", fields.kind],
		["Status", fields.status],
		["Owner", fields.owner],
		["Next action", fields.nextAction],
	].map(([label, value]) => (
		<Fragment key={label}>
			<dt>{label}</dt>
			<dd>{value ?? "Not recorded"}</dd>
		</Fragment>
	));
	const relationships =
		keyed(fields.relationships ?? [], (link) => `${link.kind}:${link.target}`).map(({ key, value: link }) => (
			<li key={key}>
				{link.kind.replace("_", " ")}: <Reference document={document} target={link.target} />
			</li>
		)) ?? [];
	const items =
		fields.items?.map((id) => (
			<li key={id}>
				<Reference document={document} target={id} />
			</li>
		)) ?? [];
	return (
		<>
			<dl>{values}</dl>
			{relationships.length > 0 && (
				<>
					<h3>Relationships</h3>
					<ul>{relationships}</ul>
				</>
			)}
			{items.length > 0 && (
				<>
					<h3>Declared board membership</h3>
					<ul>{items}</ul>
				</>
			)}
		</>
	);
}
function SourceInfo({ document }: { readonly document: Document }) {
	const reading = document.reading;
	return (
		<>
			<p>
				Source: {document.file}:{reading?.lines.id ?? 1}; prose starts at line {reading?.proseLine ?? 1}.
			</p>
			{Boolean(reading?.raw) && (
				<details data-key="frontmatter-source">
					<summary>Original frontmatter</summary>
					<pre>{reading?.raw}</pre>
				</details>
			)}
		</>
	);
}
