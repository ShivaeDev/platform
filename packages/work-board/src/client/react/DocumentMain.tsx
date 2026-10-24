import { Cause, Option } from "effect";
import { useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document } from "#browser/document/schema.ts";
import { DocumentPage } from "./DocumentPage.tsx";
import { documentTitle } from "./documentRoute.ts";
import { EmptyState } from "./EmptyState.tsx";
import { LoadingPage } from "./LoadingPage.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";
import { PageFailure } from "./PageFailure.tsx";
import { ProjectionMain } from "./ProjectionMain.tsx";
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
	const hostRef = useDocumentPage({
		data,
		failure: Option.getOrUndefined(query.cause),
		onPage,
		pending: query.pending,
		status,
		title: documentTitle(url),
		url,
	});
	if (data?.reading?.board) {
		return <ProjectionMain api={api} onPage={onPage} route="board" url={url} />;
	}
	return (
		<>
			<main
				className="document-view min-w-0 p-4 md:p-8"
				data-decision-packet={data && decisionPacket(data) ? "" : undefined}
				data-file=""
				data-react-document
				data-url=""
				id={shellIds.doc}
				ref={hostRef}
				tabIndex={-1}
			>
				{data ? (
					<DocumentPage api={api} document={data} key={data.identity ?? data.file} />
				) : (
					<NoDocument failed={Option.isSome(query.cause)} failure={failure} onRetry={query.refresh} retrying={query.pending} url={url} />
				)}
			</main>
			{data !== undefined && Option.isSome(query.cause) && <p role="status">Refresh failed. Your displayed page is retained.</p>}
		</>
	);
}
function decisionPacket(document: Document) {
	return document.metadata.kind === "question" && (document.metadata.attention?.some((request) => request.managed) ?? false);
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
function NoDocument({
	failed,
	failure,
	onRetry,
	retrying,
	url,
}: {
	readonly failed: boolean;
	readonly failure: { readonly _tag: string } | undefined;
	readonly onRetry: () => void;
	readonly retrying: boolean;
	readonly url: string;
}) {
	if (failure?._tag === "NotFound") {
		return <NotFoundPage url={url} />;
	}
	if (!failed) {
		return <LoadingPage />;
	}
	if (failure?._tag === "Conflict") {
		return <EmptyState title="Two items share this ID">Give each item its own ID in its file, then open the link again.</EmptyState>;
	}
	return <PageFailure failure={failure} onRetry={onRetry} retrying={retrying} />;
}
