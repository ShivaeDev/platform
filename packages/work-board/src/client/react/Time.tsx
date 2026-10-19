import { cn } from "cn";
import { Clock, Effect } from "effect";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { exactTime, timeLabel } from "./timeLabel.ts";

function currentTime() {
	return Effect.runSync(Clock.currentTimeMillis);
}
const NowContext = createContext(currentTime());

export function TimeTicker({ children }: { readonly children: ReactNode }) {
	const [now, setNow] = useState(currentTime);
	useEffect(() => {
		const timer = setInterval(() => setNow(currentTime()), 5000);
		return () => clearInterval(timer);
	}, []);
	return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function TimeAsOf({ now, children }: { readonly now: number; readonly children: ReactNode }) {
	return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

function TimeElement({
	at,
	className,
	title,
}: {
	readonly at: number;
	readonly className?: string | undefined;
	readonly title?: string | undefined;
}) {
	return (
		<time className={className} data-modified={at} dateTime={new Date(at).toISOString()} title={title}>
			{timeLabel(at, useContext(NowContext))}
		</time>
	);
}

export function RowTime({ at, className }: { readonly at: number; readonly className?: string | undefined }) {
	return <TimeElement at={at} className={cn("whitespace-nowrap font-sans tabular-nums", className)} title={exactTime(at)} />;
}

export function Time({ at, className }: { readonly at: number; readonly className?: string | undefined }) {
	return (
		<Popover>
			<PopoverTrigger
				className={cn(
					"cursor-default whitespace-nowrap rounded-sm font-sans tabular-nums underline decoration-current/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
					className,
				)}
				openOnHover
			>
				<TimeElement at={at} />
			</PopoverTrigger>
			<PopoverContent aria-label="Exact time" className="w-auto" side="top">
				{exactTime(at)}
			</PopoverContent>
		</Popover>
	);
}
