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

export function Time({ at, className }: { readonly at: number; readonly className?: string | undefined }) {
	const label = timeLabel(at, useContext(NowContext));
	return (
		<Popover>
			<PopoverTrigger
				className={cn(
					"cursor-default whitespace-nowrap rounded-sm font-sans tabular-nums underline decoration-current/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
					className,
				)}
				openOnHover
			>
				<time data-modified={at} dateTime={new Date(at).toISOString()}>
					{label}
				</time>
			</PopoverTrigger>
			<PopoverContent aria-label="Exact time" className="w-auto" side="top">
				{exactTime(at)}
			</PopoverContent>
		</Popover>
	);
}
