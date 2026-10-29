import { cn } from "cn";
import { History, PanelsTopLeft } from "lucide-react";
import { type ReactNode, useContext, useEffect } from "react";
import type { Navigation } from "#browser/Navigation.ts";
import { ActiveGoals } from "#client/react/ActiveGoals.tsx";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Button } from "#client/react/components/ui/button.tsx";
import { destinationName } from "#client/react/destinationName.ts";
import { InboxCount } from "#client/react/Header.tsx";
import { LibraryContext } from "#client/react/LibraryContext.ts";
import { LinkButton } from "#client/react/LinkButton.tsx";
import { MergeCount } from "#client/react/MergeCount.tsx";
import type { MainLocation } from "#client/react/mainLocation.ts";
import { useCurrentDestination } from "#client/react/navigationTarget.ts";
import { PinnedLinks, RecentLinks } from "#client/react/readingLinks.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { shellIds } from "#client/react/shellIds.ts";
import { useShownInboxCount } from "#client/react/useShownInboxCount.ts";
import type { SidebarControls } from "#client/react/useSidebar.ts";
import { workspaceDestinations } from "#client/react/workspaceDestinations.ts";

export function Sidebar({
	api,
	data,
	main,
	home,
	controls,
	navigated,
}: {
	readonly api: ShellApi;
	readonly data: Navigation | undefined;
	readonly main: MainLocation;
	readonly home: boolean;
	readonly controls: SidebarControls;
	readonly navigated: boolean;
}) {
	const reading = useContext(LibraryContext);
	const current = useCurrentDestination(main);
	const counts = {
		today: useShownInboxCount(data, navigated),
		work: data?.counts.now,
	};
	const workCount =
		counts.work === undefined ? null : (
			<Badge aria-hidden="true" variant="secondary">
				{counts.work}
			</Badge>
		);
	function name(view: (typeof workspaceDestinations)[number]["view"], label: string) {
		if (view === "today") {
			return destinationName(label, counts.today, "need you");
		}
		return view === "work" ? destinationName(label, counts.work, "open tasks", "open task") : label;
	}
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
			className="bg-card text-card-foreground sticky top-0 flex h-dvh flex-col gap-5 overflow-y-auto border-r p-4 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(320px,calc(100vw-48px))] print:hidden"
			hidden={!controls.open}
			id={shellIds.sidebar}
			role={controls.narrow && controls.open ? "dialog" : undefined}
		>
			<a
				aria-current={home ? "page" : undefined}
				className="text-foreground flex items-center gap-2 px-2 py-3 text-lg font-semibold no-underline"
				href="/"
			>
				<PanelsTopLeft aria-hidden="true" className="text-primary size-5" />
				work board
			</a>
			<nav aria-label="Workspace" className="grid shrink-0 gap-1" data-inbox-count={String(counts.today ?? "?")} id={shellIds.primaryNavigation}>
				{workspaceDestinations.map(({ label, href, view, id }) => (
					<WorkspaceLink current={current === view} href={href} id={id} key={view} name={name(view, label)}>
						<span>{label}</span>
						{view === "today" && <InboxCount count={counts.today} id={shellIds.inboxCount} />}
						{view === "work" && workCount}
						{view === "pull-requests" && <MergeCount />}
					</WorkspaceLink>
				))}
			</nav>
			<PinnedLinks current={main.file} />
			{current === "today" ? null : (
				<section aria-label="Active goals">
					<h2 className="text-muted-foreground mb-2 px-2 text-xs font-semibold">Active goals</h2>
					{navigated ? <ActiveGoals api={api} /> : null}
				</section>
			)}
			<RecentLinks current={main.file} />
			<Button
				aria-haspopup="dialog"
				className="text-muted-foreground mt-auto justify-start"
				id={shellIds.libraryOpen}
				onClick={(event) => reading.openHistory(event.currentTarget)}
				size="sm"
				type="button"
				variant="ghost"
			>
				<History aria-hidden="true" />
				Reading history
			</Button>
		</aside>
	);
}
function WorkspaceLink({
	current,
	href,
	id,
	name,
	children,
}: {
	readonly current: boolean;
	readonly href: string;
	readonly id: string;
	readonly name: string;
	readonly children: ReactNode;
}) {
	return (
		<LinkButton
			aria-current={current ? "page" : undefined}
			aria-label={name}
			className={cn("justify-between no-underline", current && "bg-accent")}
			href={href}
			id={id}
			size="default"
			variant="ghost"
		>
			{children}
		</LinkButton>
	);
}
