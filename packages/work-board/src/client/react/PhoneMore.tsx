import { History } from "lucide-react";
import { Button } from "#client/react/components/ui/button.tsx";
import { MergeCount } from "#client/react/MergeCount.tsx";
import { PinnedLinks, RecentLinks } from "#client/react/readingLinks.tsx";
import { workspaceDestinations } from "#client/react/workspaceDestinations.ts";

type Destination = (typeof workspaceDestinations)[number]["view"];

export function PhoneMore({
	current,
	file,
	onOpenHistory,
}: {
	readonly current: Destination | undefined;
	readonly file: string;
	readonly onOpenHistory: () => void;
}) {
	return (
		<>
			<MoreDestinations current={current} />
			<MoreReading current={file} onOpenHistory={onOpenHistory} />
		</>
	);
}

function MoreDestinations({ current }: { readonly current: Destination | undefined }) {
	return (
		<nav aria-label="More destinations" className="grid gap-1 px-4">
			{workspaceDestinations.slice(3).map(({ href, label, view }) => (
				<a
					aria-current={current === view ? "page" : undefined}
					className="text-foreground hover:bg-muted focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground flex min-h-12 items-center rounded-md px-3 no-underline outline-none focus-visible:ring-3"
					href={href}
					key={view}
				>
					{label}
					{view === "pull-requests" && (
						<span className="ml-auto">
							<MergeCount />
						</span>
					)}
				</a>
			))}
		</nav>
	);
}

function MoreReading({ current, onOpenHistory }: { readonly current: string; readonly onOpenHistory: () => void }) {
	return (
		<div className="grid gap-4 px-4">
			<PinnedLinks current={current} />
			<RecentLinks current={current} />
			<Button className="justify-start" onClick={onOpenHistory} type="button" variant="ghost">
				<History aria-hidden="true" />
				Reading history
			</Button>
		</div>
	);
}
