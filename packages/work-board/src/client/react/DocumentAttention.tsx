import type { Document } from "#browser/document/schema.ts";
import { fileUrl } from "#files/url.ts";
import { keyed } from "./keyed.ts";
import { Reference } from "./Reference.tsx";
export function DocumentAttention({ document }: { readonly document: Document }) {
	const requests = document.metadata.attention ?? [];
	if (requests.length === 0) {
		return null;
	}
	return (
		<>
			<h3>Recorded attention requests</h3>
			<p>Open/closed is source state. Closing a request does not establish acceptance or record an answer.</p>
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
	const respond = document.requests.some((entry) => entry.id === request.id && entry.open)
		? `#answer-card-${request.id}`
		: `/_board/respond?item=${encodeURIComponent(document.metadata.id ?? "")}&request=${encodeURIComponent(request.id)}`;
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
				{receipt === undefined && (
					<>
						<a href={respond}>Respond to this request</a> ·{" "}
					</>
				)}
				<a href={`/_board/item/${encodeURIComponent(document.metadata.id ?? "")}/`}>Reviewed item</a>
			</p>
			<p>
				Source: {/[a-f\d]{64}/iu.test(document.file) ? <a href={fileUrl(document.file)}>Open source file</a> : document.file}:
				{document.reading?.lines[`attention.${index}`] ?? document.reading?.lines.attention ?? 2}
			</p>
		</li>
	);
}
