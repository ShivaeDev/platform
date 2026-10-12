import { useRouterState } from "@tanstack/react-router";
import { Option } from "effect";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { documentRoute } from "./documentRoute.ts";
import { Header } from "./Header.tsx";
import { LegacyMain } from "./LegacyMain.tsx";
import { legacyPage, type MainLocation } from "./legacyPage.ts";
import type { ShellApi } from "./ShellApi.ts";
import { Sidebar } from "./Sidebar.tsx";
import { shellIds } from "./shellIds.ts";
export interface ShellOptions {
	readonly api: ShellApi;
	readonly initial: string;
	readonly ready?: () => void;
}
export function BoardShell({ api, initial, ready }: ShellOptions) {
	const location = useRouterState({ select: (state) => state.resolvedLocation ?? state.location });
	const [main, setMain] = useState<MainLocation>(() => {
		const doc = legacyPage(initial).getElementById("doc");
		return { file: doc?.dataset.file ?? "", view: doc?.dataset.view ?? "" };
	});
	const [bootstrapHome] = useState(() => {
		const doc = legacyPage(initial).getElementById("doc");
		return doc?.classList.contains("board-view") ? { file: doc.dataset.file ?? "", identity: doc.dataset.identity } : undefined;
	});
	const query = useQuery(api.navigation.query({ current: main.view ? "" : main.file }), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	const onPage = useCallback(
		(next: MainLocation) => setMain((previous) => (previous.file === next.file && previous.view === next.view ? previous : next)),
		[],
	);
	useEffect(() => {
		function start() {
			if (document.getElementById("doc")?.dataset.route) {
				ready?.();
			}
		}
		start();
		document.addEventListener("board-page", start);
		return () => document.removeEventListener("board-page", start);
	}, [ready]);
	useEffect(() => {
		function sync() {
			const doc = document.getElementById("doc");
			if (doc) {
				onPage({ file: doc.dataset.file ?? "", view: doc.dataset.view ?? "" });
			}
		}
		document.addEventListener("board-page", sync);
		return () => document.removeEventListener("board-page", sync);
	}, [onPage]);
	useEffect(() => {
		if (data) {
			document.dispatchEvent(new Event("board-index-change"));
		}
	}, [data]);
	return (
		<>
			<a className="skip" href="#doc">
				Skip to content
			</a>
			<div className="workspace">
				<Sidebar data={data} home={location.pathname === "/"} main={main} />
				<div className="sidebar-backdrop" hidden id={shellIds.sidebarBackdrop} />
				<div className="page">
					<Header count={data?.inboxCount ?? null} main={main} />
					{documentRoute(location.pathname, data ? data.home : bootstrapHome) ? (
						<DocumentMain api={api} initial={initial} onPage={onPage} url={location.pathname + location.searchStr} />
					) : (
						<LegacyMain api={api} initial={initial} onPage={onPage} url={location.pathname + location.searchStr} />
					)}
				</div>
			</div>
			{Option.isSome(query.cause) && <p role="status">Navigation refresh failed. Your displayed files are retained.</p>}
		</>
	);
}
