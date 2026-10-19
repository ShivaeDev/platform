import { Fragment } from "react";
import type { BoardProjection } from "#browser/views/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { Age } from "./Age.tsx";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { documentElements } from "./documentElements.tsx";
import { ItemActions, ItemSummary } from "./ItemSummary.tsx";

function BoardCounts({ counts }: { readonly counts: BoardProjection["counts"] }) {
	return (
		<>
			<span className="counts">
				{counts.map((column, index) => (
					<Fragment key={column.title}>
						{index > 0 && " · "}
						<b className="font-medium text-foreground">{column.count}</b> {column.title.toLowerCase()}
					</Fragment>
				))}
			</span>
			{" · "}
		</>
	);
}

export function HomeBoard({ data }: { readonly data: BoardProjection }) {
	return (
		<DocumentView
			actions={<ItemActions document={data.document} />}
			answer={<AnswerPanel document={data.document} />}
			board={data.counts}
			components={documentElements}
			context={<DocumentContext document={data.document} />}
			document={data.document}
			introduction={
				<>
					<ItemSummary document={data.document} />
					<p className="mt-2">
						{data.counts.length > 0 && <BoardCounts counts={data.counts} />}
						updated <Age modified={data.document.modified} short /> ago
					</p>
				</>
			}
		/>
	);
}
