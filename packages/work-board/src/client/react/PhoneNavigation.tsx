import { useRouter } from "@tanstack/react-router";
import { CalendarDays, Ellipsis, Flag, type LucideIcon, Search, Zap } from "lucide-react";
import { useContext, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "#client/react/components/ui/sheet.tsx";
import { destinationName } from "#client/react/destinationName.ts";
import { LibraryContext } from "#client/react/LibraryContext.ts";
import { NeedsYouBadge } from "#client/react/NeedsYouBadge.tsx";
import { PhoneMore } from "#client/react/PhoneMore.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { useCurrentDestination } from "./navigationTarget.ts";
import { shellIds } from "./shellIds.ts";
import { useMedia } from "./useMedia.ts";
import { useTextFocus } from "./useTextFocus.ts";
import { workspaceDestinations } from "./workspaceDestinations.ts";

const icons = [CalendarDays, Flag, Zap];
const TAB_CLASS =
	"flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md border-0 bg-transparent p-0 text-foreground text-xs no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground";

export function PhoneNavigation({
	count,
	main,
	more,
	onMoreChange,
	openSearch,
}: {
	readonly count: number | null;
	readonly main: MainLocation;
	readonly more: boolean;
	readonly onMoreChange: (open: boolean) => void;
	readonly openSearch: () => void;
}) {
	const router = useRouter();
	const narrow = useMedia("(max-width: 767px)");
	const typing = useTextFocus();
	const current = useCurrentDestination(main);
	const reading = useContext(LibraryContext);
	const openerRef = useRef<HTMLButtonElement>(null);
	const historyRef = useRef(false);
	useEffect(() => {
		if (!narrow) {
			onMoreChange(false);
		}
	}, [narrow, onMoreChange]);
	useEffect(() => router.subscribe("onBeforeNavigate", () => onMoreChange(false)), [router, onMoreChange]);
	return (
		<>
			<nav
				aria-label="Phone navigation"
				className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-background px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden print:hidden"
				hidden={typing}
			>
				{workspaceDestinations.slice(0, 3).map(({ label, href, view }, index) => (
					<PhoneTab
						count={view === "today" ? count : null}
						current={current === view}
						href={href}
						icon={icons[index] ?? CalendarDays}
						key={view}
						label={label}
					/>
				))}
				<button aria-haspopup="dialog" className={TAB_CLASS} onClick={() => openSearch()} type="button">
					<Search aria-hidden="true" className="size-5" />
					Search
				</button>
				<button
					aria-controls="phone-more"
					aria-expanded={more}
					aria-haspopup="dialog"
					className={TAB_CLASS}
					onClick={() => {
						historyRef.current = false;
						onMoreChange(true);
					}}
					ref={openerRef}
					type="button"
				>
					<Ellipsis aria-hidden="true" className="size-5" />
					More
				</button>
			</nav>
			<Sheet onOpenChange={onMoreChange} open={more}>
				<SheetContent
					aria-describedby={undefined}
					className="max-h-[80dvh] gap-4 overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] text-sm"
					finalFocus={() => (historyRef.current ? false : openerRef.current)}
					id={shellIds.phoneMore}
					side="bottom"
				>
					<SheetHeader>
						<SheetTitle>More</SheetTitle>
					</SheetHeader>
					<PhoneMore
						current={current}
						file={main.file}
						onOpenHistory={() => {
							historyRef.current = true;
							onMoreChange(false);
							reading.openHistory(openerRef.current);
						}}
					/>
				</SheetContent>
			</Sheet>
		</>
	);
}

function PhoneTab({
	count,
	current,
	href,
	icon: Icon,
	label,
}: {
	readonly count: number | null;
	readonly current: boolean;
	readonly href: string;
	readonly icon: LucideIcon;
	readonly label: string;
}) {
	return (
		<a aria-current={current ? "page" : undefined} aria-label={destinationName(label, count, "need you")} className={TAB_CLASS} href={href}>
			<span className="relative">
				<Icon aria-hidden="true" className="size-5" />
				{count ? <NeedsYouBadge aria-hidden="true" className="absolute -top-1.5 left-3.5" count={count} /> : null}
			</span>
			{label}
		</a>
	);
}
