import { useRouterState } from "@tanstack/react-router";
import { Option } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useCallback, useContext, useEffect, useState } from "react";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { BrowserClient } from "#browserClient.ts";
import { BoardMain } from "#client/react/BoardMain.tsx";
import { FleetProvider } from "#client/react/FleetProvider.tsx";
import { FormContext } from "#client/react/FormContext.ts";
import { Header } from "#client/react/Header.tsx";
import { MainLocationContext, useMainLocation } from "#client/react/MainLocationContext.ts";
import { emptyMainLocation, type MainLocation } from "#client/react/mainLocation.ts";
import { OpeningView } from "#client/react/OpeningView.tsx";
import { PhoneNavigation } from "#client/react/PhoneNavigation.tsx";
import { ReadingLibrary } from "#client/react/ReadingLibrary.tsx";
import { ReadingReadyContext, readingReady } from "#client/react/ReadingReadyContext.ts";
import { navigationQuery } from "#client/react/routeQuery.ts";
import { SearchDialog } from "#client/react/SearchDialog.tsx";
import { SessionContext } from "#client/react/SessionContext.ts";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { ShellLiveStatus } from "#client/react/ShellLiveStatus.tsx";
import { Sidebar } from "#client/react/Sidebar.tsx";
import { shellIds } from "#client/react/shellIds.ts";
import { ThemeContext } from "#client/react/ThemeContext.ts";
import { UpdatesToggle } from "#client/react/UpdatesToggle.tsx";
import { useAppearance } from "#client/react/useAppearance.ts";
import { useBoardNavigation } from "#client/react/useBoardNavigation.ts";
import { useOpened } from "#client/react/useOpened.ts";
import { useSearchDialog } from "#client/react/useSearchDialog.ts";
import { useShownInboxCount } from "#client/react/useShownInboxCount.ts";
import { useSidebar } from "#client/react/useSidebar.ts";
import { VisualInspection } from "#client/react/VisualInspection.tsx";
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
	const query = useQuery(navigationQuery(api), { keepPreviousData: true });
	const opened = useOpened(options.opening);
	const data = Option.getOrUndefined(query.data);
	const { element } = useContext(ReadingReadyContext);
	useEffect(() => {
		const doc = document.getElementById("doc");
		if (data && main.route && doc && readingReady(doc, element)) {
			ready?.();
		}
	}, [ready, data, main, element]);
	const inboxCount = useShownInboxCount(data, Option.isSome(query.cause));
	const live = <ShellLiveStatus client={client} failed={Option.isSome(query.cause)} pending={query.pending} />;
	const content = (
		<FleetProvider api={api}>
			<ReadingLibrary api={api}>
				<a className="bg-background sr-only rounded-md p-3 focus:not-sr-only focus:absolute focus:z-50" href="#doc">
					Skip to content
				</a>
				<div
					className="bg-background text-foreground grid min-h-dvh grid-cols-1 md:data-[sidebar=open]:grid-cols-[248px_minmax(0,1fr)] print:block"
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
							count={inboxCount}
							live={live}
							main={main}
							openSearch={search.show}
							sidebar={sidebar}
							status={status}
							updates={client ? <UpdatesToggle client={client} /> : null}
						/>
						{opened ? <BoardMain api={api} home={data?.home} onPage={onPage} url={url} /> : <OpeningView url={url} />}
						<PhoneNavigation count={inboxCount ?? null} main={main} more={phoneOpen} onMoreChange={setPhoneOpen} openSearch={search.show} />
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
		</FleetProvider>
	);
	return client ? <FormContext.Provider value={client}>{content}</FormContext.Provider> : content;
}
