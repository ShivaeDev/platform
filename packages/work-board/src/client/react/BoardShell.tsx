import { useRouterState } from "@tanstack/react-router";
import { Option } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useCallback, useContext, useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { BrowserClient } from "#client/client.ts";
import { AgeTicker } from "./AgeLabel.tsx";
import { FleetMain } from "./FleetMain.tsx";
import { FormContext } from "./FormContext.ts";
import { Header } from "./Header.tsx";
import { useLiveRead } from "./liveReady.ts";
import { MainLocationContext, useMainLocation } from "./MainLocationContext.ts";
import { emptyMainLocation, type MainLocation } from "./mainLocation.ts";
import { OpeningView } from "./OpeningView.tsx";
import { PhoneNavigation } from "./PhoneNavigation.tsx";
import { ReadingLibrary } from "./ReadingLibrary.tsx";
import { ReadingReadyContext, readingReady } from "./ReadingReadyContext.ts";
import { navigationQuery } from "./routeQuery.ts";
import { SearchDialog } from "./SearchDialog.tsx";
import { SessionContext } from "./SessionContext.ts";
import type { ShellApi } from "./ShellApi.ts";
import { ShellLiveStatus } from "./ShellLiveStatus.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { shellIds } from "./shellIds.ts";
import { ThemeContext } from "./ThemeContext.ts";
import { UpdatesToggle } from "./UpdatesToggle.tsx";
import { useAppearance } from "./useAppearance.ts";
import { useBoardNavigation } from "./useBoardNavigation.ts";
import { useOpened } from "./useOpened.ts";
import { useSearchDialog } from "./useSearchDialog.ts";
import { useSidebar } from "./useSidebar.ts";
import { VisualInspection } from "./VisualInspection.tsx";
export interface ShellOptions {
	readonly api: ShellApi;
	readonly client?: BrowserClient;
	readonly opening?: Promise<void> | undefined;
	readonly reading?: unknown;
	readonly ready?: () => void;
	readonly registry: AtomRegistry.AtomRegistry;
}
export function BoardShell(options: ShellOptions) {
	const [main, onPage] = useState(emptyMainLocation);
	const appearance = useAppearance();
	const [element, setElement] = useState<HTMLElement | null>(null);
	const report = useCallback((next: HTMLElement, ready: boolean) => {
		setElement((current) => {
			if (ready) {
				return next;
			}
			return current === next ? null : current;
		});
	}, []);
	return (
		<MainLocationContext.Provider value={main}>
			<ReadingReadyContext.Provider value={{ element, report }}>
				<SessionContext.Provider value={options.client}>
					<ThemeContext.Provider value={appearance.scheme}>
						<BoardWorkspace {...options} appearance={appearance} onPage={onPage} />
					</ThemeContext.Provider>
				</SessionContext.Provider>
			</ReadingReadyContext.Provider>
		</MainLocationContext.Provider>
	);
}
function BoardWorkspace(
	options: ShellOptions & { readonly appearance: ReturnType<typeof useAppearance>; readonly onPage: (location: MainLocation) => void },
) {
	const { api, ready, client, onPage, appearance } = options;
	const main = useMainLocation();
	const sidebar = useSidebar(appearance);
	const [phoneOpen, setPhoneOpen] = useState(false);
	const closeCurrentDestination = useCallback(() => {
		sidebar.close();
		setPhoneOpen(false);
	}, [sidebar.close]);
	const status = useBoardNavigation(options, closeCurrentDestination);
	const search = useSearchDialog();
	const location = useRouterState({ select: (state) => state.location });
	const url = location.pathname + location.searchStr;
	const query = useQuery(useLiveRead(client?.updates, navigationQuery(api)), { keepPreviousData: true });
	const opened = useOpened(options.opening);
	const data = Option.getOrUndefined(query.data);
	const { element } = useContext(ReadingReadyContext);
	useEffect(() => {
		const doc = document.getElementById("doc");
		if (data && main.route && doc && readingReady(doc, element)) {
			ready?.();
		}
	}, [ready, data, main, element]);
	const live = <ShellLiveStatus client={client} failed={Option.isSome(query.cause)} pending={query.pending} />;
	const content = (
		<AgeTicker>
			<ReadingLibrary api={api}>
				<a className="sr-only rounded-md bg-background p-3 focus:not-sr-only focus:absolute focus:z-50" href="#doc">
					Skip to content
				</a>
				<div
					className="grid min-h-dvh grid-cols-1 bg-background text-foreground md:data-[sidebar=open]:grid-cols-[248px_minmax(0,1fr)] print:block"
					data-board-workspace
					data-sidebar={sidebar.open ? "open" : "closed"}
				>
					<Sidebar
						api={api}
						controls={sidebar}
						data={data}
						home={location.pathname === "/"}
						main={main}
						navigated={data !== undefined || Option.isSome(query.cause)}
					/>
					<button
						aria-label="Close sidebar"
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
						{opened ? <FleetMain api={api} home={data?.home} onPage={onPage} url={url} /> : <OpeningView url={url} />}
						<PhoneNavigation main={main} more={phoneOpen} onMoreChange={setPhoneOpen} openSearch={search.show} />
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
