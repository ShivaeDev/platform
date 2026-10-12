import { Cause, Option } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { fileUrl } from "#files/url.ts";
import type { MainLocation } from "./legacyPage.ts";
import { projectionChanges, type RenderedProjection } from "./projectionChanges.ts";
import type { ProjectionRoute } from "./projectionRoute.ts";
import { shellIds } from "./shellIds.ts";

export function ProjectionFrame<A, E>({
	atom,
	location,
	onPage,
	render,
	source,
	route,
	url,
}: {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	readonly location: (data: A) => MainLocation & { readonly identity?: string | undefined; readonly status: number };
	readonly onPage: (location: MainLocation) => void;
	readonly render: (data: A) => ReactNode;
	readonly source?: (data: A) => string | undefined;
	readonly route: ProjectionRoute;
	readonly url: string;
}) {
	const query = useQuery(atom);
	const fresh = Option.getOrUndefined(query.data);
	const failure = Option.getOrUndefined(Option.flatMap(query.cause, Cause.findErrorOption));
	const missing = typeof failure === "object" && failure !== null && "_tag" in failure && failure._tag === "NotFound";
	const conflict = typeof failure === "object" && failure !== null && "_tag" in failure && failure._tag === "Conflict";
	const data = missing || conflict ? undefined : fresh;
	const main = data === undefined ? { file: "", status: missing ? 404 : 503, view: route === "board" ? "" : route } : location(data);
	const expectedSource = data === undefined ? undefined : source?.(data);
	const hostRef = useRef<HTMLElement>(null);
	const renderedRef = useRef<RenderedProjection | undefined>(undefined);
	const failed = Option.isSome(query.cause);
	useLayoutEffect(() => {
		const element = hostRef.current;
		if (!element || query.pending || (data === undefined && !failed)) {
			return;
		}
		const mainElement = element;
		let active = true;
		function announce() {
			queueMicrotask(() => {
				if (
					!active
					|| (expectedSource !== undefined
						&& mainElement.querySelector<HTMLElement>(".board[data-source], .document-layout > article.doc[data-source]")?.dataset.source
							!== expectedSource)
				) {
					return;
				}
				renderedRef.current = projectionChanges(mainElement, renderedRef.current, url);
				mainElement.dataset.route = url;
				flushSync(() => onPage({ file: main.file, view: main.view }));
				document.dispatchEvent(new Event("board-page"));
			});
		}
		const observer = new MutationObserver((records) => {
			if (
				records.some(
					(record) =>
						record.target instanceof Element
						&& (record.target.matches(".document-layout") || record.target.closest("article.doc, .item-introduction"))
						&& !record.target.closest(".age"),
				)
			) {
				announce();
			}
		});
		observer.observe(element, { attributeFilter: ["data-source"], attributes: true, childList: true, subtree: true });
		announce();
		return () => {
			active = false;
			observer.disconnect();
		};
	}, [data, failed, query.pending, expectedSource, main.file, main.view, onPage, url]);
	return (
		<>
			<main
				className="board-view"
				data-file={main.file}
				data-identity={"identity" in main ? main.identity : undefined}
				data-projection={route}
				data-react-projection
				data-status={main.status}
				data-url={route === "board" ? fileUrl(main.file) : url}
				data-view={main.view}
				id={shellIds.doc}
				ref={hostRef}
				tabIndex={-1}
			>
				{data === undefined ? (
					<p className="empty" role="status">
						{loadingMessage(query.pending, missing)}
					</p>
				) : (
					render(data)
				)}
			</main>
			{data !== undefined && Option.isSome(query.cause) && <p role="status">Refresh failed. Your displayed view is retained.</p>}
		</>
	);
}

function loadingMessage(pending: boolean, missing: boolean) {
	if (pending) {
		return "Opening view…";
	}
	return missing ? "The board source is missing." : "This view could not be opened. Retry the link or reload the page.";
}
