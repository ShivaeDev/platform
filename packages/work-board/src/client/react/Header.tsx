import { AlertCircle, Inbox, PanelLeft, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "#client/react/components/ui/Badge.tsx";
import { Button } from "#client/react/components/ui/Button.tsx";
import { buttonVariants } from "#client/react/components/ui/buttonVariants.ts";
import type { MainLocation } from "./mainLocation.ts";
import { SettingsPopover } from "./SettingsPopover.tsx";
import { shellIds } from "./shellIds.ts";
import type { AppearanceControls } from "./useAppearance.ts";
import type { SidebarControls } from "./useSidebar.ts";
export function InboxCount({ count, id }: { readonly count: number | null; readonly id: string }) {
	return (
		<Badge aria-label={`${count ?? "?"} waiting`} id={id} role="status">
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
		<header className="flex h-14 min-w-0 items-center gap-2 border-b bg-background px-3 text-sm md:px-6 print:hidden">
			<Button
				aria-controls="sidebar"
				aria-expanded={sidebar.open}
				id={shellIds.sidebarToggle}
				onClick={() => sidebar.toggle()}
				size="sm"
				variant="ghost"
			>
				<PanelLeft aria-hidden="true" />
				<span className="hidden sm:inline">Files</span>
			</Button>
			<Breadcrumbs file={main.file} />
			<a
				aria-current={main.view === "inbox" ? "page" : undefined}
				className={buttonVariants({ size: "sm", variant: "ghost" })}
				href="/_board/inbox"
				id={shellIds.inboxTopbar}
			>
				<Inbox aria-hidden="true" />
				<span className="hidden sm:inline">Inbox</span>
				<InboxCount count={count} id={shellIds.inboxTopbarCount} />
			</a>
			<Button
				aria-controls="search-dialog"
				aria-haspopup="dialog"
				aria-label="Search"
				id={shellIds.searchOpen}
				onClick={() => openSearch()}
				size="sm"
				variant="ghost"
			>
				<Search aria-hidden="true" />
				<span className="hidden sm:inline">Search</span>
				<kbd className="hidden text-muted-foreground text-xs lg:inline">⌘/Ctrl K</kbd>
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
			className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap text-muted-foreground text-xs"
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
