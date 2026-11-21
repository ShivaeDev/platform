import type { ReactElement } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { useField } from "@shivaedev/form/react.ts";
import { useEditor } from "#client/editor.ts";
import type { FailureLayout } from "#client/QueryView.ts";
import type { LoadedQueryState } from "#client/useLoaderQuery.ts";
import { archivedNotice, type Reports } from "#test/query-failures/backend.ts";

interface Report {
	readonly title: string;
}

// The screens write no failure handling beyond the one rejection the app declared.
export function ReportScreen({ report }: { readonly report: LoadedQueryState<Report, unknown> }): ReactElement {
	return (
		<main>
			<h1>{report.data.title}</h1>
			<button data-pending={report.pending} onClick={report.refresh} type="button">
				Refresh
			</button>
		</main>
	);
}

export function ReportEditor({
	reports,
	report,
}: {
	readonly reports: ContractClient<typeof Reports>;
	readonly report: { readonly loaded: Report; readonly query: ReturnType<ContractClient<typeof Reports>["report"]["query"]> };
}): ReactElement {
	const editor = useEditor(reports.rename, { ...report, queryFailures: { ReportArchived: archivedNotice } });
	const title = useField(editor.form, "title");
	return (
		<main>
			<h1>{editor.query.data.title}</h1>
			<input aria-label="Title" onChange={(event) => title.onChange(event.target.value)} value={title.value} />
			<button data-pending={editor.query.pending} onClick={editor.query.refresh} type="button">
				Refresh
			</button>
		</main>
	);
}

// An application's own screen for every route that could not load.
export function OwnFailureScreen({ message, retry }: FailureLayout) {
	function handleRetry() {
		retry();
	}
	return (
		<section>
			<h1>This page could not load</h1>
			<p role="alert">{message}</p>
			<button onClick={handleRetry} type="button">
				Retry
			</button>
		</section>
	);
}
