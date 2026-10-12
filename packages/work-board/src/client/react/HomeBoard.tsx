import type { BoardProjection } from "#browser/views/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
export function HomeBoard({ data }: { readonly data: BoardProjection }) {
	return (
		<>
			<DocumentContext document={data.document} />
			<DocumentView board={data.counts} document={data.document} />
			{data.document.metadata.kind === "question" && data.document.metadata.question === undefined && data.document.identity && (
				<AnswerPanel document={data.document} />
			)}
		</>
	);
}
