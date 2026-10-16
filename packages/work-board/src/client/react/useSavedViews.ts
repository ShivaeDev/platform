import { Option, Schema } from "effect";
import { useRef, useState } from "react";

const Entry = Schema.Struct({ name: Schema.NonEmptyString, url: Schema.String });
export function localView(value: string) {
	try {
		const url = new URL(value, location.href);
		if (value.length > 8192 || url.origin !== location.origin || url.pathname !== "/_board/work") {
			return undefined;
		}
		for (const name of [...url.searchParams.keys()]) {
			if (!["view", "board", "owner", "status", "q", "sort"].includes(name)) {
				url.searchParams.delete(name);
			}
		}
		return url.pathname + url.search;
	} catch {
		return undefined;
	}
}
function restore(key: string) {
	const views: (typeof Entry.Type)[] = [];
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
		if (Array.isArray(saved)) {
			for (const raw of saved) {
				const entry = Option.getOrUndefined(Schema.decodeUnknownOption(Entry)(raw));
				const url = entry && localView(entry.url);
				if (!(entry && url && entry.name.trim()) || entry.name.length > 60 || views.some((view) => view.name === entry.name)) {
					continue;
				}
				views.push({ name: entry.name, url });
				if (views.length === 10) {
					break;
				}
			}
		}
		return { notice: "", views };
	} catch {
		return { notice: "Saved views could not be restored; new views apply to this page until saved.", views };
	}
}
export function useSavedViews() {
	const key = `work-board:views:${document.documentElement.dataset.workspace}`;
	const [saved, setSaved] = useState(() => restore(key));
	const savedRef = useRef(saved);
	const [selected, select] = useState("");
	function persist(views: typeof saved.views) {
		let notice = "";
		try {
			localStorage.setItem(key, JSON.stringify(views));
		} catch {
			notice = "Saved views apply to this page only; browser storage is unavailable.";
		}
		savedRef.current = { notice, views };
		setSaved(savedRef.current);
	}
	function save(name: string, url: string) {
		const local = localView(url);
		if (!(name && local)) {
			return;
		}
		if (savedRef.current.views.length === 10 && !savedRef.current.views.some((view) => view.name === name)) {
			setSaved({ ...saved, notice: "You have 10 saved views. Remove one or update an existing name." });
			return;
		}
		persist([{ name, url: local }, ...savedRef.current.views.filter((view) => view.name !== name)]);
		select(name);
	}
	return {
		...saved,
		clear: () => {
			persist([]);
			select("");
		},
		remove: () => {
			persist(saved.views.filter((view) => view.name !== selected));
			select("");
		},
		save,
		select,
		selected,
	};
}
