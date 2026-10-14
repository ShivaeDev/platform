import type { RespondProjection } from "#browser/views/remaining.ts";
export function RespondPage({ data }: { readonly data: RespondProjection }) {
	return (
		<a href={`/_board/item/${encodeURIComponent(data.document.identity ?? "")}/#answer-card-${encodeURIComponent(data.request.id)}`}>
			Open the answer card
		</a>
	);
}
