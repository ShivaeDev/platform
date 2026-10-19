import { Option } from "effect";
import { useState } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Library, LibraryFile } from "#browser/navigation/library.ts";
import { sentenceLabel, statusLabel } from "#browser/views/statusLabel.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { LoadingRows } from "./loading.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { RowTime } from "./Time.tsx";
export function LibraryContents({
	api,
	data,
	filters,
	onClear,
	view,
}: {
	readonly api: ShellApi;
	readonly data: Library;
	readonly filters: Filters;
	readonly onClear?: (() => void) | undefined;
	readonly view: string;
}) {
	if (data.files.length === 0 && data.folders.length === 0) {
		return <NoDocuments filtered={Boolean(filters.kind || filters.status)} onClear={onClear} />;
	}
	if (view === "folders") {
		return <FolderContents api={api} data={data} filters={filters} />;
	}
	const files = view === "recently changed" ? data.files.toSorted((a, b) => b.modified - a.modified || a.path.localeCompare(b.path)) : data.files;
	return <DocumentList files={files} />;
}
function NoDocuments({ filtered, onClear }: { readonly filtered: boolean; readonly onClear?: (() => void) | undefined }) {
	return filtered ? (
		<EmptyState
			action={
				onClear ? (
					<Button onClick={onClear} size="sm" type="button" variant="outline">
						Show all documents
					</Button>
				) : undefined
			}
			title="No matching documents"
		>
			No document has the chosen kind and status.
		</EmptyState>
	) : (
		<EmptyState action={<LinkButton href="/_board/start">Getting started</LinkButton>} title="No documents yet">
			Markdown files in this workspace appear here as soon as they are saved.
		</EmptyState>
	);
}
function DocumentList({ files }: { readonly files: readonly LibraryFile[] }) {
	return files.length === 0 ? null : (
		<ul className="m-0 list-none divide-y p-0">
			{files.map((file) => (
				<li className="flex flex-wrap items-center justify-between gap-2 py-3" key={file.path}>
					<div className="min-w-0">
						<a className="break-words font-medium" href={file.href}>
							{file.title}
						</a>
						<p className="m-0 text-muted-foreground text-xs">
							{sentenceLabel(file.kind)}
							{file.status ? ` · ${statusLabel(file.status)}` : ""}
						</p>
					</div>
					<span className="shrink-0 text-muted-foreground text-xs" data-updated>
						Updated <RowTime at={file.modified} />
					</span>
				</li>
			))}
		</ul>
	);
}
interface Filters {
	readonly kind?: string;
	readonly showFleet?: boolean;
	readonly status?: string;
}
function FolderContents({ api, data, filters }: { readonly api: ShellApi; readonly data: Library; readonly filters: Filters }) {
	return (
		<>
			<DocumentList files={data.files} />
			{data.folders.map((folder) => (
				<LazyFolder api={api} filters={filters} folder={folder} key={folder.path} />
			))}
		</>
	);
}
function LazyFolder({ api, folder, filters }: { readonly api: ShellApi; readonly folder: Library["folders"][number]; readonly filters: Filters }) {
	const [open, setOpen] = useState(false);
	return (
		<details className="my-3 border-l pl-4" onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
			<summary className="cursor-pointer py-2">
				{folder.name} ({folder.count})
			</summary>
			{open ? <ExpandedFolder api={api} filters={filters} path={folder.path} /> : null}
		</details>
	);
}
function ExpandedFolder({ api, filters, path }: { readonly api: ShellApi; readonly filters: Filters; readonly path: string }) {
	const query = useQuery(api.library.query({ ...filters, folder: path }, { timeToLive: 0 }), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	return (
		<>
			{data === undefined && query.pending ? <LoadingRows framed={false} label="Loading folder" rows={2} /> : null}
			{Option.isSome(query.cause) && <p role="alert">This folder could not be loaded.</p>}
			{data ? <FolderContents api={api} data={data} filters={filters} /> : null}
		</>
	);
}
