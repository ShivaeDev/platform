import { type Library, type LibraryState, libraryInput, libraryState, libraryUrl } from "#browser/navigation/library.ts";
import { LibraryContents } from "./LibraryContents.tsx";
import { LibraryControls } from "./LibraryControls.tsx";
import { useEntryPaging } from "./libraryPaging.ts";
import { PageHeader } from "./PageHeader.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

export function LibraryPage({ api, data, url }: { readonly api: ShellApi; readonly data: Library; readonly url: string }) {
	const state = libraryState(url);
	const paging = useEntryPaging();
	const filtered = Boolean(state.kind || state.status || state.query);
	return (
		<div className="max-w-5xl">
			<PageHeader summary="Every document in this workspace. Filter by kind or status, or browse by folder." title="Library" />
			<LibraryControls data={data} state={state} />
			<LibraryCount data={data} shown={paging.shown} state={state} />
			<section aria-label="Documents" id={shellIds.libraryResults}>
				<LibraryContents
					api={api}
					clearHref={filtered ? libraryUrl(state, { kind: "", query: "", status: "" }) : undefined}
					data={data}
					filters={libraryInput(state)}
					paging={paging}
					view={state.view}
				/>
			</section>
		</div>
	);
}

function LibraryCount({ data, shown, state }: { readonly data: Library; readonly shown: number; readonly state: LibraryState }) {
	const total = state.view === "folders" ? data.files.length + data.folders.reduce((sum, folder) => sum + folder.count, 0) : data.files.length;
	if (total === 0) {
		return null;
	}
	const documents = `${total} ${total === 1 ? "document" : "documents"}`;
	return (
		<p className="text-muted-foreground mb-2 text-xs" role="status">
			{state.view === "folders" || total <= shown ? documents : `${shown} shown · ${documents}`}
		</p>
	);
}
