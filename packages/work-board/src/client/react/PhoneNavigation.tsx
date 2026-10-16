import { CalendarDays, Ellipsis, Flag, Search, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#client/react/components/ui/Button.tsx";
import { Modal } from "./Modal.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { shellIds } from "./shellIds.ts";
import { useMedia } from "./useMedia.ts";
import { workspaceDestinations } from "./workspaceDestinations.ts";

const icons = [CalendarDays, Flag, Zap];
const TAB_CLASS =
	"flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md border-0 bg-transparent p-0 text-foreground text-xs no-underline aria-[current=page]:bg-accent aria-[current=page]:text-primary";

export function PhoneNavigation({ main, openSearch }: { readonly main: MainLocation; readonly openSearch: () => void }) {
	const [more, setMore] = useState(false);
	const narrow = useMedia("(max-width: 767px)");
	useEffect(() => {
		if (!narrow) {
			setMore(false);
		}
	}, [narrow]);
	useEffect(() => {
		function close() {
			setMore(false);
		}
		document.addEventListener("board-navigate", close);
		return () => document.removeEventListener("board-navigate", close);
	}, []);
	return (
		<>
			<nav
				aria-label="Phone navigation"
				className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-background px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden print:hidden"
			>
				{workspaceDestinations.slice(0, 3).map(({ label, href, view }, index) => {
					const Icon = icons[index] ?? CalendarDays;
					return (
						<a aria-current={main.view === view ? "page" : undefined} className={TAB_CLASS} href={href} key={view}>
							<Icon aria-hidden="true" className="size-5" />
							{label}
						</a>
					);
				})}
				<button aria-controls="search-dialog" aria-haspopup="dialog" className={TAB_CLASS} onClick={() => openSearch()} type="button">
					<Search aria-hidden="true" className="size-5" />
					Search
				</button>
				<button
					aria-controls="phone-more"
					aria-expanded={more}
					aria-haspopup="dialog"
					className={TAB_CLASS}
					onClick={() => setMore(true)}
					type="button"
				>
					<Ellipsis aria-hidden="true" className="size-5" />
					More
				</button>
			</nav>
			<Modal className="phone-more" close={() => setMore(false)} id={shellIds.phoneMore} open={more} title={shellIds.phoneMoreTitle}>
				<div className="mb-3 flex items-center justify-between">
					<h2 className="font-semibold" id={shellIds.phoneMoreTitle}>
						More
					</h2>
					<Button onClick={() => setMore(false)} variant="ghost">
						Close
					</Button>
				</div>
				<nav aria-label="More destinations" className="grid gap-2">
					{workspaceDestinations.slice(3).map(({ href, label, view }) => (
						<a
							aria-current={main.view === view ? "page" : undefined}
							className="flex min-h-12 items-center rounded-md px-3 hover:bg-accent"
							href={href}
							key={view}
						>
							{label}
						</a>
					))}
				</nav>
			</Modal>
		</>
	);
}
