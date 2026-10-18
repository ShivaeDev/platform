import { AlertCircle, Inbox, PanelLeft, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Button, buttonVariants } from "#client/react/components/ui/button.tsx";
import { destinationName } from "#client/react/destinationName.ts";
import { KeyboardHints } from "./KeyboardHints.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { SettingsPopover } from "./SettingsPopover.tsx";
import { shellIds } from "./shellIds.ts";
import type { AppearanceControls } from "./useAppearance.ts";
import type { SidebarControls } from "./useSidebar.ts";
export function InboxCount({ count, id }: { readonly count: number | null; readonly id: string }) {
	return (
		<Badge aria-label={count === null ? "Needs you unavailable" : `${count} need you`} id={id} role="status" variant="secondary">
			{count ?? "?"}
		</Badge>
	);
}
export function Header({
	main,
	count,
	appearance,
	sidebar,
	openSearch,
	live,
	updates,
	status,
}: {
	readonly main: MainLocation;
	readonly count: number | null;
	readonly appearance: AppearanceControls;
	readonly sidebar: SidebarControls;
	readonly openSearch: () => void;
	readonly live: ReactNode;
	readonly updates: ReactNode;
	readonly status: string;
}) {
	return (
		<header
			className="sticky top-0 z-20 flex h-12 min-w-0 items-center gap-2 border-b bg-background px-3 text-sm md:h-14 md:px-6 print:hidden"
			data-workspace-header
		>
			<Button
				aria-controls="sidebar"
				aria-expanded={sidebar.open}
				aria-label="Files"
				id={shellIds.sidebarToggle}
				onClick={() => sidebar.toggle()}
				size="sm"
				type="button"
				variant="ghost"
			>
				<PanelLeft aria-hidden="true" />
				<span className="hidden sm:inline">Files</span>
			</Button>
			<span className="min-w-0 flex-1 truncate font-medium md:hidden">{main.title ?? main.file}</span>
			<Breadcrumbs file={main.title ?? main.file} />
			<a
				aria-current={main.view === "today" ? "page" : undefined}
				aria-label={destinationName("Today", count, "need you")}
				className={buttonVariants({ className: "hidden md:inline-flex", size: "sm", variant: "ghost" })}
				data-slot="link-button"
				href="/"
				id={shellIds.inboxTopbar}
			>
				<Inbox aria-hidden="true" />
				<span className="hidden sm:inline">Today</span>
				<InboxCount count={count} id={shellIds.inboxTopbarCount} />
			</a>
			<Button
				aria-haspopup="dialog"
				aria-label="Search"
				className="hidden md:inline-flex"
				id={shellIds.searchOpen}
				onClick={() => openSearch()}
				size="sm"
				type="button"
				variant="ghost"
			>
				<Search aria-hidden="true" />
				<span className="hidden sm:inline">Search</span>
				<KeyboardHints>
					<kbd className="hidden text-muted-foreground text-xs lg:inline">⌘/Ctrl K</kbd>
				</KeyboardHints>
			</Button>
			<div className="hidden shrink-0 md:block">{live}</div>
			<span className="shrink-0 text-destructive" id={shellIds.navigationStatus} role="status" title={status}>
				{Boolean(status) && <AlertCircle aria-hidden="true" className="size-4" />}
				<span className="sr-only">{status}</span>
			</span>
			<SettingsPopover appearance={appearance} updates={updates} />
		</header>
	);
}

function Breadcrumbs({ file }: { readonly file: string }) {
	const parts = file.split("/");
	return (
		<nav
			aria-label="File location"
			className="hidden min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap text-muted-foreground text-xs md:flex"
			id={shellIds.breadcrumbs}
		>
			<a className="shrink-0 text-foreground" href="/">
				Workspace
			</a>
			{parts.map((part, index) => (
				<span className="truncate" key={parts.slice(0, index + 1).join("/")}>
					<span className="text-muted-foreground">/</span> {part}
				</span>
			))}
		</nav>
	);
}
