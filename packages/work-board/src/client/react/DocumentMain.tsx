import { Cause, Option } from "effect";
import { useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { Document } from "#browser/document/schema.ts";
import { documentQuery } from "#client/page/routeQuery.ts";
import { DocumentPage } from "./DocumentPage.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionMain } from "./ProjectionMain.tsx";
import { RemainingMain } from "./RemainingMain.tsx";
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
	const [retained, setRetained] = useState<Document>();
	useEffect(() => {
		if (fresh) {
			setRetained(fresh);
		}
	}, [fresh]);
	const failure = Option.getOrUndefined(Option.flatMap(query.cause, Cause.findErrorOption));
	const terminal = failure?._tag === "Conflict" || failure?._tag === "NotFound";
	const data = terminal ? undefined : (fresh ?? retained);
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
			<main className="document-view" data-file="" data-react-document data-url="" id={shellIds.doc} ref={hostRef} tabIndex={-1}>
				{data ? (
					<DocumentPage document={data} key={data.identity ?? data.file} />
				) : (
					<p className="empty" role="status">
						{loadingMessage(failure?._tag, Option.isSome(query.cause), url)}
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
function loadingMessage(tag: string | undefined, failed: boolean, url: string) {
	if (tag === "Conflict") {
		return "The document identity is duplicated. No document was selected. Inspect the project files to resolve the duplicate ID.";
	}
	if (tag === "NotFound" && /\.md$/iu.test(new URL(url, "http://127.0.0.1").pathname)) {
		return `No markdown file at ${decodeURIComponent(new URL(url, "http://127.0.0.1").pathname.slice(1))}.`;
	}
	return failed ? "This document could not be opened. Retry the link or reload the page." : "Opening document…";
}
