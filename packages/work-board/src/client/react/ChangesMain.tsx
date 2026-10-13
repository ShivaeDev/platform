import type { HistoryOutput } from "#history/schema.ts";
import { HistoryComparison } from "./HistoryComparison.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";
import { useHistoryComparison } from "./useHistoryComparison.ts";
export function ChangesMain({
	api,
	onPage,
	url,
}: {
	readonly api: ShellApi;
	readonly onPage: (location: MainLocation) => void;
	readonly url: string;
}) {
	const history = useHistoryComparison(api);
	return (
		<ProjectionFrame
			atom={history.atom}
			location={() => ({ file: "Changes", status: 200, view: "changes" })}
			onPage={onPage}
			render={(result) => <ChangesPage history={history} result={result} />}
			route="changes"
			url={url}
		/>
	);
}
function ChangesPage({ history, result }: { readonly history: ReturnType<typeof useHistoryComparison>; readonly result: HistoryOutput }) {
	const { baseline, busy, clear: handleClear, message, notice, observe, available } = history;
	let content = <p>{result.reason}</p>;
	if (result.comparison) {
		content = <HistoryComparison data={result.comparison} />;
	}
	if (message) {
		content = <p role="status">{message}</p>;
	}
	function handleObserve() {
		void observe();
	}
	return (
		<section className="history" data-baseline={baseline ?? ""}>
			<h1>Changes since seen</h1>
			<p>
				Compare current Markdown with one observation you explicitly remember in this browser. This is an observed source comparison, not an event
				journal, Git history, authorship, or verified acceptance.
			</p>
			<p>
				Remembered source can include old or deleted content. One snapshot per workspace, up to 2 MiB, expires after 30 days and is removed on your
				next workspace visit. Mark seen replaces it; Clear forgets it. No source writes or cloud storage.
			</p>
			<div className="history-controls">
				<button disabled={busy || result.snapshot === null || !available} id={shellIds.historyMark} onClick={handleObserve} type="button">
					{baseline ? "Mark current workspace seen" : "Start remembering changes"}
				</button>
				<button disabled={busy || !baseline} id={shellIds.historyClear} onClick={handleClear} type="button">
					Clear remembered history
				</button>
				<span id={shellIds.historyStorage} role="status">
					{notice}
				</span>
			</div>
			<div aria-live="polite" id={shellIds.changesContent}>
				{content}
			</div>
		</section>
	);
}
