import type { Document } from "#browser/document/schema.ts";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { keyed } from "./keyed.ts";
import { LinkButton } from "./LinkButton.tsx";
import { Reference } from "./Reference.tsx";
export function DocumentAttention({ document }: { readonly document: Document }) {
	const requests = document.metadata.attention ?? [];
	if (requests.length === 0) {
		return null;
	}
	return (
		<>
			<h3 title="Open/closed is source state. Closing a request does not establish acceptance or record an answer.">Recorded attention requests</h3>
			<ul>
				{keyed(requests, (entry) => entry.id).map(({ index, key }) => (
					<Request document={document} index={index} key={key} />
				))}
			</ul>
		</>
	);
}
function Request({ document, index }: { readonly document: Document; readonly index: number }) {
	const request = document.metadata.attention?.[index];
	if (!request) {
		return null;
	}
	const receipt = document.reading?.receipts[request.id];
	const id =
		document.metadata.attention?.filter((entry) => entry.id === request.id).length === 1
			? `attention-request-${request.id}`
			: `attention-record-${index}`;
	const respond = responseUrl(document.metadata.id ?? "", request.id);
	const hashed = /[a-f\d]{64}/iu.test(document.file);
	const targets = request.unblocks.map((target, targetIndex) => (
		<span key={target}>
			{targetIndex > 0 && ", "}
			<Reference document={document} target={target} />
		</span>
	));
	return (
		<li id={id} tabIndex={-1}>
			<b>
				{request.kind} · {request.id} · {request.state}
			</b>
			{receipt !== undefined && (
				<>
					<p>
						Managed request acknowledged: {receipt.disposition}. Source state remains {request.state}. This receipt does not establish acceptance.
					</p>
					<p>
						Reviewed question: <Reference document={document} target={receipt.question} />
					</p>
				</>
			)}
			{!document.requests.some((entry) => entry.id === request.id && entry.open) && <p>{request.reason}</p>}
			<p>Response needed from: {request.responseFrom.join(", ")}</p>
			<p>Recorded to unblock: {targets}</p>
			<p>
				Source: {hashed ? "line " : `${document.file}:`}
				{document.reading?.lines[`attention.${index}`] ?? document.reading?.lines.attention ?? 2}
			</p>
			<div className="flex flex-wrap gap-2">
				{receipt === undefined && <LinkButton href={respond}>Respond to this request</LinkButton>}
				<LinkButton href={`/_board/item/${encodeURIComponent(document.metadata.id ?? "")}/`}>Reviewed item</LinkButton>
				{hashed && <LinkButton href={fileUrl(document.file)}>Open source file</LinkButton>}
			</div>
		</li>
	);
}
