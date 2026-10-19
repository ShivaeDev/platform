import { useRouter } from "@tanstack/react-router";
import { CalendarDays, Ellipsis, Flag, History, Search, Zap } from "lucide-react";
import { useContext, useEffect, useRef } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "#client/react/components/ui/sheet.tsx";
import { LibraryContext } from "#client/react/LibraryContext.ts";
import { ReadingLinks } from "#client/react/ReadingLinks.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { useCurrentDestination } from "./navigationTarget.ts";
import { shellIds } from "./shellIds.ts";
import { useMedia } from "./useMedia.ts";
import { workspaceDestinations } from "./workspaceDestinations.ts";

const icons = [CalendarDays, Flag, Zap];
const TAB_CLASS =
	"flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md border-0 bg-transparent p-0 text-foreground text-xs no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground";

export function PhoneNavigation({
	main,
	more,
	onMoreChange,
	openSearch,
}: {
	readonly main: MainLocation;
	readonly more: boolean;
	readonly onMoreChange: (open: boolean) => void;
	readonly openSearch: () => void;
}) {
	const router = useRouter();
	const narrow = useMedia("(max-width: 767px)");
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
			>
				{workspaceDestinations.slice(0, 3).map(({ label, href, view }, index) => {
					const Icon = icons[index] ?? CalendarDays;
					return (
						<a aria-current={current === view ? "page" : undefined} className={TAB_CLASS} href={href} key={view}>
							<Icon aria-hidden="true" className="size-5" />
							{label}
						</a>
					);
				})}
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
					<MoreDestinations current={current} />
					<MoreReading
						current={main.file}
						openHistory={() => {
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

function MoreDestinations({ current }: { readonly current: string | undefined }) {
	return (
		<nav aria-label="More destinations" className="grid gap-1 px-4">
			{workspaceDestinations.slice(3).map(({ href, label, view }) => (
				<a
					aria-current={current === view ? "page" : undefined}
					className="flex min-h-12 items-center rounded-md px-3 text-foreground no-underline outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
					href={href}
					key={view}
				>
					{label}
				</a>
			))}
		</nav>
	);
}

function MoreReading({ current, openHistory }: { readonly current: string; readonly openHistory: () => void }) {
	const reading = useContext(LibraryContext);
	return (
		<div className="grid gap-4 px-4">
			<ReadingLinks current={current} items={reading.favorites} title="Pinned" />
			<ReadingLinks current={current} items={reading.recents.slice(0, 5)} title="Recent" />
			<Button className="justify-start" onClick={openHistory} type="button" variant="ghost">
				<History aria-hidden="true" />
				Reading history
			</Button>
		</div>
	);
}
