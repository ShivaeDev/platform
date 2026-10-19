import { Clock, Effect } from "effect";
import { type ComponentProps, createContext, type ReactNode, useContext, useEffect, useState } from "react";

const TimeContext = createContext(Effect.runSync(Clock.currentTimeMillis));
function now() {
	return Effect.runSync(Clock.currentTimeMillis);
}
export function AgeTicker({ children }: { readonly children: ReactNode }) {
	const [time, setTime] = useState(now);
	useEffect(() => {
		const timer = setInterval(() => setTime(now()), 5000);
		return () => clearInterval(timer);
	}, []);
	return <TimeContext.Provider value={time}>{children}</TimeContext.Provider>;
}
function since(seconds: number) {
	if (seconds < 60) {
		return `${seconds}s`;
	}
	if (seconds < 3600) {
		return `${Math.round(seconds / 60)}m`;
	}
	if (seconds < 172_800) {
		return `${Math.round(seconds / 3600)}h`;
	}
	return `${Math.round(seconds / 86_400)}d`;
}
export interface AgeProps {
	readonly modified: number;
	readonly short?: boolean;
}
export function AgeLabel({ modified, short = false, className, ...props }: AgeProps & Omit<ComponentProps<"time">, "children" | "dateTime">) {
	const ago = since(Math.max(0, Math.round((useContext(TimeContext) - modified) / 1000)));
	const base = short ? "shrink-0 whitespace-nowrap font-mono text-muted-foreground text-xs" : "ml-1.5 whitespace-nowrap font-mono text-muted-foreground text-xs";
	return (
		<time {...props} className={className ? `${base} ${className}` : base} data-modified={modified} dateTime={new Date(modified).toISOString()}>
			{short ? ago : `updated ${ago} ago`}
		</time>
	);
}
