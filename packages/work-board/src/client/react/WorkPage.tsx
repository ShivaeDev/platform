import type { WorkProjection } from "#browser/views/schema.ts";
import { viewUrl } from "#browser/views/state.ts";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { LinkButton } from "#client/react/LinkButton.tsx";
import { PageHeader } from "#client/react/PageHeader.tsx";
import { SavedViews } from "#client/react/SavedViews.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { shellIds } from "#client/react/shellIds.ts";
import { WorkControls } from "#client/react/WorkControls.tsx";
import { WorkDetail } from "#client/react/WorkDetail.tsx";
import { WorkResults } from "#client/react/WorkResults.tsx";
import { WorkTools } from "#client/react/WorkTools.tsx";
export function WorkPage({ data, api }: { readonly data: WorkProjection; readonly api?: ShellApi | undefined }) {
	const { state } = data;
	const source = `/_board/item/${encodeURIComponent(state.board)}/`;
	return (
		<>
			<PageHeader
				actions={Boolean(state.board) && data.validBoard && <LinkButton href={source}>Board source</LinkButton>}
				className="work-head mb-6"
				summary={state.view !== "now" && <p className="work-eyebrow m-0">WORK · {state.view.toUpperCase()} VIEW</p>}
				title={data.validBoard ? data.title : "Board unavailable"}
			/>
			<WorkTools state={state} />
			<details className="work-options mb-4" open={state.view !== "now"}>
				<summary className="cursor-pointer text-muted-foreground text-sm">Filter</summary>
				<SavedViews url={viewUrl(state, { item: "" })} />
				<WorkControls data={data} key={viewUrl(state)} />
			</details>
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
			{data.state.view !== "now" && (
				<p className="work-total" role="status">
					{data.rows.length} shown · {data.items.length} items in this view
				</p>
			)}
			<div className={data.state.item ? "work-layout has-detail" : "work-layout"}>
				<section aria-label="Work items" id={shellIds.workResults} tabIndex={-1}>
					{data.items.length === 0 ? <NoWork data={data} /> : <WorkResults data={data} />}
				</section>
				<WorkDetail api={api} data={data} />
			</div>
		</>
	);
}
function NoWork({ data: { state } }: { readonly data: WorkProjection }) {
	return state.board ? (
		<EmptyState action={<LinkButton href={viewUrl(state, { board: "" })}>All work</LinkButton>} title="No work on this board">
			This board lists no work items yet. Work joins a board when its Markdown names the board.
		</EmptyState>
	) : (
		<EmptyState action={<LinkButton href="/_board/start">Getting started</LinkButton>} title="No work yet">
			Work appears here when a file in this workspace gives a task an ID and a status.
		</EmptyState>
	);
}
