import { Option } from "effect";
import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { Library, LibraryFile, LibraryInput, LibraryView } from "#browser/navigation/library.ts";
import { kindLabel, statusLabel } from "#browser/views/statusLabel.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { type Paging, useLocalPaging } from "./libraryPaging.ts";
import { LoadingRows } from "./loading.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { RowTime } from "./Time.tsx";

export function LibraryContents({
	api,
	clearHref,
	data,
	filters,
	paging,
	view,
}: {
	readonly api: ShellApi;
	readonly clearHref?: string | undefined;
	readonly data: Library;
	readonly filters: LibraryInput;
	readonly paging?: Paging | undefined;
	readonly view: LibraryView;
}) {
	const files = useMemo(
		() => (view === "recently-changed" ? data.files.toSorted((a, b) => b.modified - a.modified || a.path.localeCompare(b.path)) : data.files),
		[data.files, view],
	);
	if (data.files.length === 0 && data.folders.length === 0) {
		return <NoDocuments clearHref={clearHref} />;
	}
	if (view === "folders") {
		return <FolderContents api={api} data={data} filters={filters} />;
	}
	return <DocumentList files={files} paging={paging} />;
}
function NoDocuments({ clearHref }: { readonly clearHref: string | undefined }) {
	return clearHref ? (
		<EmptyState action={<LinkButton href={clearHref}>Show all documents</LinkButton>} title="No matching documents">
			No document matches these filters.
		</EmptyState>
	) : (
		<EmptyState action={<LinkButton href="/_board/start">Getting started</LinkButton>} title="No documents yet">
			Markdown files in this workspace appear here as soon as they are saved.
		</EmptyState>
	);
}
function DocumentList({ files, paging }: { readonly files: readonly LibraryFile[]; readonly paging?: Paging | undefined }) {
	const local = useLocalPaging();
	const { shown, showMore } = paging ?? local;
	const listRef = useRef<HTMLUListElement>(null);
	if (files.length === 0) {
		return null;
	}
	return (
		<>
			<ul className="m-0 list-none divide-y p-0" ref={listRef}>
				{files.slice(0, shown).map((file) => (
					<DocumentRow file={file} key={file.path} />
				))}
			</ul>
			{files.length > shown && (
				<Button
					className="mt-4"
					onClick={() => {
						flushSync(showMore);
						listRef.current?.children[shown]?.querySelector("a")?.focus();
					}}
					size="sm"
					type="button"
					variant="outline"
				>
					Show more
				</Button>
			)}
		</>
	);
}
function DocumentRow({ file }: { readonly file: LibraryFile }) {
	return (
		<li className="flex flex-wrap items-center justify-between gap-2 py-3">
			<div className="min-w-0">
				<a className="font-medium break-words" href={file.href}>
					{file.title}
				</a>
				<p className="text-muted-foreground m-0 text-xs">
					{kindLabel(file.kind)}
					{file.status ? ` · ${statusLabel(file.status)}` : ""}
				</p>
			</div>
			<span className="text-muted-foreground shrink-0 text-xs" data-updated>
				Updated <RowTime at={file.modified} />
			</span>
		</li>
	);
}
function FolderContents({ api, data, filters }: { readonly api: ShellApi; readonly data: Library; readonly filters: LibraryInput }) {
	return (
		<>
			<DocumentList files={data.files} />
			{data.folders.map((folder) => (
				<LazyFolder api={api} filters={filters} folder={folder} key={folder.path} />
			))}
		</>
	);
}
function LazyFolder({
	api,
	folder,
	filters,
}: {
	readonly api: ShellApi;
	readonly folder: Library["folders"][number];
	readonly filters: LibraryInput;
}) {
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
function ExpandedFolder({ api, filters, path }: { readonly api: ShellApi; readonly filters: LibraryInput; readonly path: string }) {
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
