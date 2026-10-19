import { Cause, Option } from "effect";
import { FileQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document } from "#browser/document/schema.ts";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#client/react/components/ui/empty.tsx";
import { DocumentPage } from "./DocumentPage.tsx";
import { LinkButton } from "./LinkButton.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionMain } from "./ProjectionMain.tsx";
import { RemainingMain } from "./RemainingMain.tsx";
import { documentQuery } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";
import { useDocumentPage } from "./useDocumentPage.ts";

export function DocumentMain({
	api,
	url,
	onPage,
}: {
	readonly api: ShellApi;
	readonly url: string;
	readonly onPage: (location: MainLocation) => void;
}) {
	const query = useQuery(documentQuery(api, url));
	const fresh = Option.getOrUndefined(query.data);
	const [retained, setRetained] = useState<{ readonly data: Document; readonly url: string }>();
	useEffect(() => {
		if (fresh) {
			setRetained({ data: fresh, url });
		}
	}, [fresh, url]);
	const failure = Option.getOrUndefined(Option.flatMap(query.cause, Cause.findErrorOption));
	const terminal = failure?._tag === "Conflict" || failure?._tag === "NotFound";
	const data = terminal ? undefined : (fresh ?? (retained?.url === url ? retained.data : undefined));
	const status = readStatus(failure?._tag, Option.isSome(query.cause));
	const hostRef = useDocumentPage({ data, onPage, pending: query.pending, status, url });
	if (data?.reading?.board) {
		return <ProjectionMain api={api} onPage={onPage} route="board" url={url} />;
	}
	if (url === "/" && failure?._tag === "NotFound") {
		return <RemainingMain api={api} onPage={onPage} route="start" url={url} />;
	}
	return (
		<>
			<main className="document-view min-w-0 p-4 md:p-8" data-file="" data-react-document data-url="" id={shellIds.doc} ref={hostRef} tabIndex={-1}>
				{data && <DocumentPage api={api} document={data} key={data.identity ?? data.file} />}
				{!data && failure?._tag === "NotFound" && <MissingPage url={url} />}
				{!(data || failure?._tag === "NotFound") && (
					<p className="empty" role="status">
						{loadingMessage(failure?._tag, Option.isSome(query.cause))}
					</p>
				)}
			</main>
			{data !== undefined && Option.isSome(query.cause) && <p role="status">Refresh failed. Your displayed page is retained.</p>}
		</>
	);
}
function readStatus(tag: string | undefined, failed: boolean) {
	if (tag === "NotFound") {
		return "404";
	}
	if (tag === "Conflict") {
		return "409";
	}
	return failed ? "503" : "200";
}
function loadingMessage(tag: string | undefined, failed: boolean) {
	if (tag === "Conflict") {
		return "The document identity is duplicated. No document was selected. Inspect the project files to resolve the duplicate ID.";
	}
	return failed ? "This document could not be opened. Retry the link or reload the page." : "Opening document…";
}
function MissingPage({ url }: { readonly url: string }) {
	const pathname = new URL(url, "http://127.0.0.1").pathname;
	const item = /^\/_board\/item\/[^/]+\/?$/u.test(pathname);
	return (
		<Empty className="mx-auto mt-8 max-w-xl border">
			<EmptyHeader role="status">
				<EmptyMedia variant="icon">
					<FileQuestion />
				</EmptyMedia>
				<EmptyTitle>{item ? "Item not found" : "File not found"}</EmptyTitle>
				<EmptyDescription>
					{item
						? `No item has the ID ${decodeURIComponent(pathname.split("/")[3] ?? "")}. It may be missing, renamed, or invalid.`
						: `No Markdown file at ${decodeURIComponent(pathname.slice(1))}. It may have been moved or deleted.`}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center">
				<LinkButton href="/">Back to Today</LinkButton>
				<LinkButton href="/_board/library">Browse the Library</LinkButton>
			</EmptyContent>
		</Empty>
	);
}
