import { useRouterState } from "@tanstack/react-router";
import { Option } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { BrowserClient } from "#client/client.ts";
import { AgeTicker } from "./Age.tsx";
import { BoardMain } from "./BoardMain.tsx";
import { Header } from "./Header.tsx";
import { HistoryRetention } from "./HistoryRetention.tsx";
import { LiveControls } from "./LiveControls.tsx";
import { bootstrapPage, type MainLocation } from "./mainLocation.ts";
import { ReadingLibrary } from "./ReadingLibrary.tsx";
import { SearchDialog } from "./SearchDialog.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { Sidebar } from "./Sidebar.tsx";
import { shellIds } from "./shellIds.ts";
import { UpdatesToggle } from "./UpdatesToggle.tsx";
import { useAppearance } from "./useAppearance.ts";
import { useBoardNavigation } from "./useBoardNavigation.ts";
import { useSearchDialog } from "./useSearchDialog.ts";
import { useSidebar } from "./useSidebar.ts";
import { VisualInspection } from "./VisualInspection.tsx";
export interface ShellOptions {
	readonly api: ShellApi;
	readonly client?: BrowserClient;
	readonly initial: string;
	readonly reading?: unknown;
	readonly ready?: () => void;
	readonly registry: AtomRegistry.AtomRegistry;
}
export function BoardShell(options: ShellOptions) {
	const { api, initial, ready, client } = options;
	const appearance = useAppearance();
	const sidebar = useSidebar(appearance);
	const status = useBoardNavigation(options);
	const search = useSearchDialog();
	const [libraryOpen, setLibraryOpen] = useState(false);
	const location = useRouterState({ select: (state) => state.resolvedLocation ?? state.location });
	const [main, setMain] = useState<MainLocation>(() => {
		const doc = bootstrapPage(initial).getElementById("doc");
		return { file: doc?.dataset.file ?? "", view: doc?.dataset.view ?? "" };
	});
	const [bootstrapHome] = useState(() => {
		const doc = bootstrapPage(initial).getElementById("doc");
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
			const doc = document.getElementById("doc");
			const context = doc?.querySelector<HTMLElement>(".item-context");
			if (data && doc?.dataset.route && (!context || context.dataset.readingReady === "true")) {
				ready?.();
			}
		}
		start();
		document.addEventListener("board-page", start);
		document.addEventListener("board-reading-ready", start);
		return () => {
			document.removeEventListener("board-page", start);
			document.removeEventListener("board-reading-ready", start);
		};
	}, [ready, data]);
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
	const live = client ? (
		<LiveControls
			client={client}
			current={location.pathname + location.searchStr}
			navigationFailed={Option.isSome(query.cause)}
			navigationPending={query.pending}
		/>
	) : (
		<span className="live" id={shellIds.live} role="status">
			connecting
		</span>
	);
	return (
		<AgeTicker>
			<ReadingLibrary close={() => setLibraryOpen(false)} data={data} open={libraryOpen}>
				<a className="skip" href="#doc">
					Skip to content
				</a>
				<div className="workspace">
					<Sidebar controls={sidebar} data={data} home={location.pathname === "/"} main={main} openLibrary={() => setLibraryOpen(true)} />
					<button
						aria-label="Close files"
						className="sidebar-backdrop"
						hidden={!(sidebar.narrow && sidebar.open)}
						id={shellIds.sidebarBackdrop}
						onClick={() => sidebar.close()}
						type="button"
					/>
					<div className="page" inert={sidebar.narrow && sidebar.open}>
						<Header
							appearance={appearance}
							count={data?.inboxCount ?? null}
							live={live}
							main={main}
							openSearch={search.show}
							sidebar={sidebar}
							status={status}
							updates={client ? <UpdatesToggle client={client} /> : null}
						/>
						<BoardMain api={api} home={data ? data.home : bootstrapHome} onPage={onPage} url={location.pathname + location.searchStr} />
					</div>
				</div>
				{Option.isSome(query.cause) && <p role="status">Navigation refresh failed. Your displayed files are retained.</p>}
				{main.view !== "changes" && <HistoryRetention api={api} />}
				<VisualInspection />
				<SearchDialog
					api={api}
					appearance={appearance}
					close={search.close}
					open={search.open}
					returnFocus={search.returnFocus}
					toggleSidebar={sidebar.toggle}
				/>
			</ReadingLibrary>
		</AgeTicker>
	);
}
