import { cn } from "cn";
import { Option } from "effect";
import { PanelsTopLeft } from "lucide-react";
import { useContext, useEffect } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Navigation } from "#browser/Navigation.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Button } from "#client/react/components/ui/button.tsx";
import { GoalProgress } from "#client/react/GoalProgress.tsx";
import { InboxCount } from "#client/react/Header.tsx";
import { type Item, LibraryContext } from "#client/react/LibraryContext.ts";
import type { MainLocation } from "#client/react/mainLocation.ts";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { shellIds } from "#client/react/shellIds.ts";
import type { SidebarControls } from "#client/react/useSidebar.ts";
import { workspaceDestinations } from "#client/react/workspaceDestinations.ts";
import { fileUrl } from "#files/url.ts";

export function Sidebar({
	api,
	data,
	main,
	home,
	controls,
	openLibrary,
}: {
	readonly api: ShellApi;
	readonly data: Navigation | undefined;
	readonly main: MainLocation;
	readonly home: boolean;
	readonly controls: SidebarControls;
	readonly openLibrary: () => void;
}) {
	const reading = useContext(LibraryContext);
	const query = useQuery(api.goals.query(undefined, { timeToLive: 60_000 }), { keepPreviousData: true });
	const goals = Option.getOrUndefined(query.data)?.goals;
	const counts = {
		today: data?.inboxCount,
		work: data?.counts.now,
	};
	useEffect(() => {
		const sidebar = document.getElementById(shellIds.sidebar);
		if (controls.narrow && controls.open) {
			sidebar?.setAttribute("aria-modal", "true");
		} else {
			sidebar?.removeAttribute("aria-modal");
		}
	}, [controls.narrow, controls.open]);
	return (
		<aside
			aria-label="Workspace navigation"
			className="sticky top-0 flex h-dvh flex-col gap-5 overflow-y-auto border-r bg-card p-4 text-card-foreground max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(320px,calc(100vw-48px))] print:hidden"
			hidden={!controls.open}
			id={shellIds.sidebar}
			role={controls.narrow && controls.open ? "dialog" : undefined}
		>
			<a
				aria-current={home ? "page" : undefined}
				className="flex items-center gap-2 px-2 py-3 font-semibold text-foreground text-lg no-underline"
				href="/"
			>
				<PanelsTopLeft aria-hidden="true" className="size-5 text-primary" />
				work board
			</a>
			<nav aria-label="Workspace" className="grid shrink-0 gap-1" data-inbox-count={String(data?.inboxCount ?? "?")} id={shellIds.primaryNavigation}>
				{workspaceDestinations.map(({ label, href, view, id }) => (
					<Button
						className={cn("justify-between no-underline", (view === "today" ? home : main.view === view) && "bg-accent")}
						key={view}
						nativeButton={false}
						render={<a aria-current={(view === "today" ? home : main.view === view) ? "page" : undefined} href={href} id={id} />}
						variant="ghost"
					>
						<span>{label}</span>
						{view === "today" && <InboxCount count={counts.today ?? null} id={shellIds.inboxCount} />}
						{view === "work" && <Badge variant="secondary">{counts.work ?? "?"}</Badge>}
					</Button>
				))}
			</nav>
			<ReadingSection current={main.file} items={reading.favorites} title="Pinned" />
			<section aria-label="Active goals">
				<h2 className="mb-2 px-2 font-semibold text-muted-foreground text-xs">Active goals</h2>
				{goals?.length === 0 && <p className="px-2 text-muted-foreground text-xs">No active goals.</p>}
				{goals?.map((goal) => (
					<div className="mb-3 px-2" key={goal.id}>
						<a className="block truncate text-sm" href={`/_board/item/${encodeURIComponent(goal.id)}/`}>
							{goal.title}
						</a>
						<GoalProgress compact counts={goal.counts} title={goal.title} />
					</div>
				))}
			</section>
			<ReadingSection current={main.file} items={reading.recents.slice(0, 5)} title="Recent" />
			<button className="mt-auto text-left text-muted-foreground text-xs" id={shellIds.libraryOpen} onClick={() => openLibrary()} type="button">
				Reading history
			</button>
		</aside>
	);
}
function ReadingSection({ title, items, current }: { readonly title: string; readonly items: readonly Item[]; readonly current: string }) {
	return (
		<section aria-label={title}>
			<h2 className="mb-2 px-2 font-semibold text-muted-foreground text-xs">{title}</h2>
			<ul className="m-0 grid list-none gap-2 p-0">
				{items.map((item) => (
					<li className="min-w-0 px-2 text-sm" key={item.file}>
						<a aria-current={item.file === current ? "page" : undefined} className="block truncate" href={fileUrl(item.file)} title={item.title}>
							{item.title}
						</a>
					</li>
				))}
			</ul>
			{items.length === 0 && (
				<p className="px-2 text-muted-foreground text-xs">{title === "Pinned" ? "Pin a document to keep it here." : "No recent documents."}</p>
			)}
		</section>
	);
}
