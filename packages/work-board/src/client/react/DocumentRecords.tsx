import type { Document } from "#browser/document/schema.ts";
import { LinkButton } from "./LinkButton.tsx";
import { Reference } from "./Reference.tsx";
import { Time } from "./Time.tsx";

export function DocumentRecords({ document: data }: { readonly document: Document }) {
	const { handoff, question, response, requestReceipt } = data.metadata;
	return (
		<>
			{handoff !== undefined && (
				<>
					<h3>Agent handoff</h3>
					<p>
						<Reference document={data} target={handoff.item} /> · {handoff.recipient} · {handoff.state}
					</p>
					<p>Receipt is separate from execution and acceptance.</p>
					<p>
						{handoff.by ?? ""}
						{Boolean(handoff.note) && ` · ${handoff.note}`}
					</p>
					<p>
						Reviewed SHA-256: <code>{handoff.reviewedRevision}</code>
					</p>
					<LinkButton href={`/_board/handoff?item=${encodeURIComponent(handoff.item)}`}>Read handoff history and copy its prompt</LinkButton>
				</>
			)}
			{question !== undefined && (
				<>
					<h3>Reviewed question</h3>
					<p>
						<Reference document={data} target={question.item} /> / {question.request} · {question.reason}
					</p>
					<p>
						Reviewed SHA-256: <code>{question.reviewedRevision}</code>. Registered: <Time at={question.registeredAt} />. Unanswered deadline:{" "}
						<Time at={question.deadline} />.
					</p>
				</>
			)}
			{response !== undefined && (
				<>
					<h3>Recorded response</h3>
					<p>
						<Reference document={data} target={response.question} /> · {response.author} · {response.type}
					</p>
					<p>
						Reviewed SHA-256: <code>{response.reviewedRevision}</code>. This is authored feedback, not verified acceptance.
					</p>
					{response.supersedes !== undefined && (
						<p>
							Explicitly supersedes <Reference document={data} target={response.supersedes} />.
						</p>
					)}
				</>
			)}
			{requestReceipt !== undefined && (
				<>
					<h3>Managed request receipt</h3>
					<p>
						<Reference document={data} target={requestReceipt.question} /> · {requestReceipt.disposition}
					</p>
					<p>
						Reviewed SHA-256: <code>{requestReceipt.reviewedRevision}</code>. This acknowledges request handling, not execution, acceptance or
						delivery authority.
					</p>
					{requestReceipt.response !== undefined && (
						<p>
							Applied response: <Reference document={data} target={requestReceipt.response} />
						</p>
					)}
				</>
			)}
		</>
	);
}
