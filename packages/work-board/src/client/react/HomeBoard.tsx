import { Fragment } from "react";
import type { BoardProjection } from "#browser/views/schema.ts";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { OutlineMenu } from "./DocumentOutline.tsx";
import { documentElements } from "./documentElements.tsx";
import { ItemActions, ItemSummary } from "./ItemSummary.tsx";
import { LazyDocumentView } from "./lazyMarkdown.tsx";

const SEPARATOR = " · ";

function BoardCounts({ counts }: { readonly counts: BoardProjection["counts"] }) {
	return (
		<span className="counts">
			{counts.map((column, index) => (
				<Fragment key={column.title}>
					{index > 0 && SEPARATOR}
					<b className="font-medium text-foreground">{column.count}</b> {column.title.toLowerCase()}
				</Fragment>
			))}
		</span>
	);
}

export function HomeBoard({ data }: { readonly data: BoardProjection }) {
	return (
		<LazyDocumentView
			actions={
				<>
					<OutlineMenu document={data.document} />
					<ItemActions document={data.document} />
				</>
			}
			answer={<AnswerPanel document={data.document} />}
			board={data.counts}
			components={documentElements}
			context={<DocumentContext document={data.document} />}
			document={data.document}
			introduction={
				<>
					<ItemSummary document={data.document} />
					{data.counts.length > 0 && (
						<p className="mt-2">
							<BoardCounts counts={data.counts} />
						</p>
					)}
				</>
			}
		/>
	);
}
