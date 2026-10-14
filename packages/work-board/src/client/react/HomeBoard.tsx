import type { BoardProjection } from "#browser/views/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { ItemSummary } from "./ItemSummary.tsx";
export function HomeBoard({ data }: { readonly data: BoardProjection }) {
	return (
		<DocumentView
			answer={<AnswerPanel document={data.document} />}
			board={data.counts}
			context={<DocumentContext document={data.document} />}
			document={data.document}
			introduction={<ItemSummary document={data.document} />}
		/>
	);
}
