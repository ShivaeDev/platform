import type { WorkProjection } from "#browser/views/schema.ts";
import { viewUrl } from "#browser/views/state.ts";
import { DocumentPage } from "./DocumentPage.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";
export function WorkDetail({ data, api }: { readonly data: WorkProjection; readonly api?: ShellApi | undefined }) {
	const { state, selected } = data;
	if (!state.item) {
		return null;
	}
	return (
		<aside aria-label="Selected work" className="work-detail" id={shellIds.workDetail} tabIndex={-1}>
			<header>
				<a className="detail-close" href={viewUrl(state, { item: "" }, "work-results")}>
					Close detail
				</a>
				<a href={`/_board/item/${encodeURIComponent(state.item)}/`}>{selected === undefined ? "Inspect item identity" : "Open document"}</a>
			</header>
			{Boolean(data.selectedOutside) && (
				<p className="detail-notice" role="status">
					This selected item is outside the current board or filters.
				</p>
			)}
			{selected === undefined ? (
				<>
					<h2>Item unavailable</h2>
					<p>
						{state.item} {data.selectionProblem}. No source was selected.
					</p>
				</>
			) : (
				<DocumentPage api={api} document={selected} key={selected.identity ?? selected.file} />
			)}
		</aside>
	);
}
