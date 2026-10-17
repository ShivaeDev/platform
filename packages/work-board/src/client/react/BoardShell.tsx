import { useRouterState } from "@tanstack/react-router";
import { Option } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { BrowserClient } from "#client/client.ts";
import { navigationQuery } from "#client/page/routeQuery.ts";
import { AgeTicker } from "./Age.tsx";
import { FleetMain } from "./FleetMain.tsx";
import { FormContext } from "./FormContext.ts";
import { Header } from "./Header.tsx";
import { LiveControls } from "./LiveControls.tsx";
import { displayedLocation, type MainLocation, sameMainLocation } from "./mainLocation.ts";
import { PhoneNavigation } from "./PhoneNavigation.tsx";
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
	readonly reading?: unknown;
	readonly ready?: () => void;
	readonly registry: AtomRegistry.AtomRegistry;
}
export function BoardShell(options: ShellOptions) {
	const { api, ready, client } = options;
	const appearance = useAppearance();
	const sidebar = useSidebar(appearance);
	const status = useBoardNavigation(options);
	const search = useSearchDialog();
	const [libraryOpen, setLibraryOpen] = useState(false);
	const location = useRouterState({ select: (state) => state.location });
	const [main, setMain] = useState<MainLocation>({ file: "", view: "" });
	const query = useQuery(navigationQuery(api), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	const onPage = useCallback((next: MainLocation) => setMain((previous) => (sameMainLocation(previous, next) ? previous : next)), []);
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
				onPage(displayedLocation(doc));
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
		<span className="font-mono text-muted-foreground text-xs" id={shellIds.live} role="status">
			connecting
		</span>
	);
	const content = (
		<AgeTicker>
			<ReadingLibrary api={api} close={() => setLibraryOpen(false)} open={libraryOpen}>
				<a className="sr-only rounded-md bg-background p-3 focus:not-sr-only focus:absolute focus:z-50" href="#doc">
					Skip to content
				</a>
				<div
					className="grid min-h-dvh grid-cols-1 bg-background text-foreground md:data-[sidebar=open]:grid-cols-[248px_minmax(0,1fr)] print:block"
					data-board-workspace
					data-sidebar={sidebar.open ? "open" : "closed"}
				>
					<Sidebar api={api} controls={sidebar} data={data} home={location.pathname === "/"} main={main} openLibrary={() => setLibraryOpen(true)} />
					<button
						aria-label="Close files"
						className="fixed inset-0 z-30 hidden border-0 bg-black/45 p-0 data-[open=true]:block md:hidden"
						data-open={sidebar.narrow && sidebar.open}
						hidden={!(sidebar.narrow && sidebar.open)}
						id={shellIds.sidebarBackdrop}
						onClick={() => sidebar.close()}
						type="button"
					/>
					<div className="min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" data-board-page inert={sidebar.narrow && sidebar.open}>
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
						<FleetMain api={api} home={data?.home} onPage={onPage} url={location.pathname + location.searchStr} />
						<PhoneNavigation main={main} openSearch={search.show} />
					</div>
				</div>
				{Option.isSome(query.cause) && <p role="status">Navigation refresh failed. Your displayed files are retained.</p>}
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
	return client ? <FormContext.Provider value={client}>{content}</FormContext.Provider> : content;
}
