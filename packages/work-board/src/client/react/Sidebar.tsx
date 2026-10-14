import { PanelsTopLeft } from "lucide-react";
import { useEffect } from "react";
import type { Navigation } from "#browser/navigation/schema.ts";
import { Button } from "#client/react/components/ui/Button.tsx";
import { buttonVariants } from "#client/react/components/ui/buttonVariants.ts";
import { cn } from "#client/react/lib/cn.ts";
import { fileUrl } from "#files/url.ts";
import { InboxCount } from "./Header.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { NavigationTree } from "./NavigationTree.tsx";
import { shellIds } from "./shellIds.ts";
import type { SidebarControls } from "./useSidebar.ts";

const views = [
	["overview", "Overview"],
	["work", "Work"],
	["changes", "Changes"],
	["diagnostics", "Diagnostics"],
] as const;
export function Sidebar({
	data,
	main,
	home,
	controls,
	openLibrary,
}: {
	readonly data: Navigation | undefined;
	readonly main: MainLocation;
	readonly home: boolean;
	readonly controls: SidebarControls;
	readonly openLibrary: () => void;
}) {
	useEffect(() => {
		if (!controls.open) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			const selected = main.file;
			const tree = document.getElementById("files");
			const active = tree?.querySelector('a[aria-current="page"]');
			if (!(data && selected && tree && active)) {
				return;
			}
			if (active.closest("details:not([open])")) {
				return;
			}
			const bounds = tree.getBoundingClientRect();
			const row = active.getBoundingClientRect();
			if (row.top < bounds.top) {
				tree.scrollTop += row.top - bounds.top;
			} else if (row.bottom > bounds.bottom) {
				tree.scrollTop += row.bottom - bounds.bottom;
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [data, main.file, controls.open]);

	useEffect(() => {
		const sidebar = document.getElementById("sidebar");
		if (controls.narrow && controls.open) {
			sidebar?.setAttribute("aria-modal", "true");
		} else {
			sidebar?.removeAttribute("aria-modal");
		}
	}, [controls.narrow, controls.open]);
	return (
		<aside
			aria-label="Workspace navigation"
			className="sticky top-0 flex h-dvh flex-col gap-3 overflow-hidden border-r bg-card p-4 text-card-foreground max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(320px,calc(100vw-48px))] print:hidden"
			hidden={!controls.open}
			id={shellIds.sidebar}
			role={controls.narrow && controls.open ? "dialog" : undefined}
		>
			<a className="flex items-center gap-2 px-2 py-3 font-semibold text-lg text-primary tracking-tight no-underline" href="/">
				<PanelsTopLeft aria-hidden="true" className="size-5" />
				work board
			</a>
			<nav aria-label="Workspace" className="grid shrink-0 gap-1" id={shellIds.primaryNavigation}>
				<a aria-current={home ? "page" : undefined} className={navClass(home)} href="/" id={shellIds.homeOpen}>
					Today
				</a>
				{data?.home !== undefined && (
					<a className={navClass(!home && main.file === data.home.file)} href={fileUrl(data.home.file)} id={shellIds.workspaceNotesOpen}>
						Workspace notes
					</a>
				)}
				<a
					aria-current={main.view === "inbox" ? "page" : undefined}
					className={navClass(main.view === "inbox")}
					href="/_board/inbox"
					id={shellIds.inboxOpen}
				>
					Inbox <InboxCount count={data?.inboxCount ?? null} id={shellIds.inboxCount} />
				</a>
				{views.map(([view, label]) => (
					<a
						aria-current={main.view === view ? "page" : undefined}
						className={navClass(main.view === view)}
						href={`/_board/${view}${view === "work" ? "?view=board" : ""}`}
						id={`${view}-open`}
						key={view}
					>
						{label}
					</a>
				))}
			</nav>
			<Button
				aria-controls="library-dialog"
				aria-haspopup="dialog"
				id={shellIds.libraryOpen}
				onClick={() => openLibrary()}
				type="button"
				variant="outline"
			>
				Recent documents
			</Button>
			<a className={navClass(false)} href="/_board/start" id={shellIds.startOpen}>
				Getting started
			</a>
			<h2 className="m-0 px-2 font-semibold text-muted-foreground text-xs">Project files</h2>
			<nav aria-label="Project files" className="min-h-0 flex-1 overflow-y-auto overscroll-contain text-sm" id={shellIds.files}>
				{data ? <NavigationTree current={main.view ? "" : main.file} data={data} /> : <p role="status">Loading files…</p>}
			</nav>
		</aside>
	);
}

function navClass(active: boolean) {
	return cn(buttonVariants({ variant: "ghost" }), "justify-between text-foreground no-underline", active && "bg-accent");
}
