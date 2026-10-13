import { Clock, Effect } from "effect";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

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
export function Age({ modified, short = false }: { readonly modified: number; readonly short?: boolean }) {
	const ago = since(Math.max(0, Math.round((useContext(TimeContext) - modified) / 1000)));
	return (
		<span className={short ? "age short" : "age"} data-modified={modified}>
			{short ? ago : `updated ${ago} ago`}
		</span>
	);
}
