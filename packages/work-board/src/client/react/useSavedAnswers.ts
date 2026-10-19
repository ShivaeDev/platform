import { useAtom } from "@effect/atom-react";
import type { Navigation } from "#browser/Navigation.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { savedAnswers } from "./savedAnswers.ts";
import { todayKey } from "./todayKey.ts";

export function useSavedAnswers(inbox: InboxProjection, navigation: Navigation | undefined) {
	const [saved, setSaved] = useAtom(savedAnswers);
	const hidden = new Set(saved.filter((entry) => entry.inbox === inbox).map((entry) => entry.key));
	return {
		items: inbox.you.filter((item) => !hidden.has(todayKey(item))),
		save: (item: InboxProjection["you"][number]) =>
			setSaved([...saved.filter((entry) => entry.inbox === inbox || entry.navigation === navigation), { inbox, key: todayKey(item), navigation }]),
	};
}
