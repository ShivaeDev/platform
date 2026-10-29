import { Cause, Option } from "effect";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { Document } from "#browser/document/schema.ts";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { LinkButton } from "./LinkButton.tsx";
import { Reference } from "./Reference.tsx";
import { ResultCriteria } from "./ResultCriteria.tsx";
import { ResultFeedback } from "./ResultFeedback.tsx";
import { resultChecks } from "./resultChecks.ts";
import { resultQuery } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

export function ItemResultReview({ api, item }: { readonly api: ShellApi; readonly item: string }) {
	const query = useQuery(resultQuery(api, item), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	if (data) {
		return <ResultReview data={data} />;
	}
	const failure = Option.getOrUndefined(Option.flatMap(query.cause, Cause.findErrorOption));
	return failure ? (
		<p className="text-muted-foreground col-span-full text-sm" data-result-unavailable role="status">
			Checks and feedback can't be shown. Reload the page to try again.
		</p>
	) : null;
}

export function ResultReview({ data }: { readonly data: ResultProjection }) {
	const checks = resultChecks(data);
	const feedback = data.feedback.length > 0 || data.unreadableFeedback.length > 0;
	const empty = emptyLine(openReviews(data.document).length === 0, checks.length === 0, !feedback);
	const linked = (data.document.metadata.relationships ?? []).map((relationship) => relationship.target);
	return (
		<section aria-label="Review" className="col-span-full min-w-0 space-y-4" data-result-review id={shellIds.resultReview}>
			{linked.length > 0 && (
				<ul className="m-0 list-none space-y-2 p-0 text-sm" data-result-linked>
					{linked.map((target) => (
						<LinkedItem document={data.document} key={target} target={target} />
					))}
				</ul>
			)}
			{checks.length > 0 && <ResultCriteria data={data} targets={checks} />}
			{feedback ? <ResultFeedback data={data} /> : null}
			{empty !== undefined && (
				<p className="text-muted-foreground m-0 text-sm" data-result-empty>
					{empty}
				</p>
			)}
		</section>
	);
}

function LinkedItem({ document, target }: { readonly document: Document; readonly target: string }) {
	const details = document.referenceDetails?.[target];
	return (
		<li className="text-foreground flex flex-wrap items-center gap-x-3 gap-y-2">
			<span className="text-muted-foreground">For</span>
			<Reference document={document} target={target} />
			{details !== undefined && (
				<LinkButton
					aria-label={`Prepare follow-up handoff for ${details.title}`}
					href={`/_board/handoff?item=${encodeURIComponent(target.replace(/#.*$/u, ""))}`}
				>
					Prepare follow-up handoff
				</LinkButton>
			)}
		</li>
	);
}

function emptyLine(noReview: boolean, noChecks: boolean, noFeedback: boolean) {
	const missing = [noReview && "no review requested", noChecks && "no checks listed", noFeedback && "no feedback yet"].filter(
		(part): part is string => typeof part === "string",
	);
	if (missing.length === 0) {
		return undefined;
	}
	const leading = missing.slice(0, -1).join(", ");
	const sentence = leading ? `${leading} and ${missing.slice(-1).join("")}` : missing.join("");
	return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

type Review = NonNullable<Document["metadata"]["attention"]>[number];

function openReviews(document: Document): readonly Review[] {
	const requests = document.metadata.attention ?? [];
	return requests.filter(
		(entry) => entry.kind === "review" && entry.state === "open" && requests.filter((other) => other.id === entry.id).length === 1,
	);
}
