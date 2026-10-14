import type { WorkProjection } from "#browser/views/schema.ts";
import { viewUrl } from "#browser/views/state.ts";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";
import { WorkControls } from "./WorkControls.tsx";
import { WorkDetail } from "./WorkDetail.tsx";
import { WorkResults } from "./WorkResults.tsx";
import { WorkTools } from "./WorkTools.tsx";
export function WorkPage({ data, api }: { readonly data: WorkProjection; readonly api?: ShellApi | undefined }) {
	const { state } = data;
	const source = `/_board/item/${encodeURIComponent(state.board)}/`;
	return (
		<>
			<header className="work-head">
				<p className="work-eyebrow">WORK · {state.view.toUpperCase()} VIEW</p>
				<h1>{data.validBoard ? data.title : "Board unavailable"}</h1>
				<p>Views use recorded fields. A section heading does not set an item's status.</p>
				{Boolean(state.board) && data.validBoard && <a href={source}>Board source</a>}
			</header>
			<WorkTools state={state} />
			<WorkControls data={data} key={viewUrl(state)} />
			{data.validBoard ? (
				<WorkContent api={api} data={data} />
			) : (
				<p className="empty">
					{state.board} is missing, has a duplicate ID, or is not a declared board. Choose another board or open its{" "}
					<a href={source}>source identity</a>.
				</p>
			)}
		</>
	);
}
function WorkContent({ data, api }: { readonly data: WorkProjection; readonly api?: ShellApi | undefined }) {
	const issues = data.issues.map((issue) => <li key={issue}>{issue}</li>);
	return (
		<>
			{issues.length > 0 && (
				<details className="view-issues">
					<summary>Source issues ({issues.length})</summary>
					<ul>{issues}</ul>
				</details>
			)}
			<p className="work-total" role="status">
				{data.rows.length} shown · {data.items.length} items in this view
			</p>
			<div className={data.state.item ? "work-layout has-detail" : "work-layout"}>
				<section aria-label="Work items" id={shellIds.workResults} tabIndex={-1}>
					{data.items.length === 0 && (
						<p className="empty">
							No identified work is declared here. Keep reading ordinary files, or add item IDs and explicit board membership in their Markdown
							sources.
						</p>
					)}
					<WorkResults data={data} />
				</section>
				<WorkDetail api={api} data={data} />
			</div>
		</>
	);
}
