import { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { fileUrl } from "#files/url.ts";
import type { MainLocation } from "./mainLocation.ts";
import { projectionChanges, type RenderedProjection } from "./projectionChanges.ts";
import type { ProjectionRoute } from "./projectionRoute.ts";
import type { RemainingRoute } from "./remainingRoute.ts";
import { shellIds } from "./shellIds.ts";
import { useProjectionData } from "./useProjectionData.ts";

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
	readonly route: ProjectionRoute | RemainingRoute;
	readonly url: string;
}) {
	const { query, failure, missing, conflict, data, content } = useProjectionData(atom, route, url);
	const main = data === undefined ? { file: "", status: failureStatus(missing, conflict), view: projectionView(route) } : location(data);
	const expectedSource = data === undefined ? undefined : source?.(data);
	const hostRef = useRef<HTMLElement>(null);
	const renderedRef = useRef<RenderedProjection | undefined>(undefined);
	const failed = Option.isSome(query.cause);
	useLayoutEffect(() => {
		const element = hostRef.current;
		if (element && element.dataset.route !== url) {
			delete element.dataset.route;
		}
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
						&& (record.target.matches(".document-layout, .board[data-source]") || record.target.closest("article.doc, .item-introduction"))
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
				className="board-view min-w-0 p-4 md:p-8"
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
				{data === undefined && (
					<p className="empty" role="status">
						{loadingMessage(query.pending, missing, failure)}
					</p>
				)}
				<div className={data === undefined ? "hidden" : "contents"} hidden={data === undefined}>
					{content === undefined ? null : render(content)}
				</div>
			</main>
			{data !== undefined && Option.isSome(query.cause) && <p role="status">Refresh failed. Your displayed view is retained.</p>}
		</>
	);
}

function loadingMessage(pending: boolean, missing: boolean, failure: unknown) {
	if (pending) {
		return "Opening view…";
	}
	if (typeof failure === "object" && failure !== null && "message" in failure && typeof failure.message === "string") {
		return failure.message;
	}
	return missing ? "The board source is missing." : "This view could not be opened. Retry the link or reload the page.";
}

function projectionView(route: ProjectionRoute | RemainingRoute) {
	if (route === "board") {
		return "";
	}
	return route === "respond" ? "response" : route;
}

function failureStatus(missing: boolean, conflict: boolean) {
	if (missing) {
		return 404;
	}
	return conflict ? 409 : 503;
}
