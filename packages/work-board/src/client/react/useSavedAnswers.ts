import { useEffect, useState } from "react";
import type { InboxProjection } from "#browser/views/schema.ts";
import { todayKey } from "./todayKey.ts";

// A saved answer leaves Needs you at once; the row stays hidden until the refreshed inbox no longer lists it.
export function useSavedAnswers(you: InboxProjection["you"]) {
	const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
	const listed = new Set(you.map(todayKey));
	const stale = [...saved].some((key) => !listed.has(key));
	useEffect(() => {
		if (stale) {
			setSaved((current) => new Set([...current].filter((key) => you.some((item) => todayKey(item) === key))));
		}
	}, [stale, you]);
	return {
		items: you.filter((item) => !saved.has(todayKey(item))),
		save: (item: InboxProjection["you"][number]) => setSaved((current) => new Set([...current, todayKey(item)])),
	};
}
