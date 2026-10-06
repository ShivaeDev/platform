import { Clock, Effect } from "effect";
import { DRAFT_AGE, type Draft, encodeDrafts, readDrafts } from "./drafts.ts";

const states = new Map<string, Draft>();
export function draftSession(key: string, revision: string, storage: Storage | undefined, storageKey: string, report: (message: string) => void) {
	function local() {
		if (!storage) {
			throw new Error("Draft storage unavailable");
		}
		return storage;
	}
	let blocked = false;
	let drafts: Record<string, Draft> = {};
	try {
		const stored = readDrafts(local().getItem(storageKey), Effect.runSync(Clock.currentTimeMillis));
		drafts = stored.drafts;
		if (stored.expired) {
			report("Expired drafts were cleared after 30 days. Saved responses are unaffected.");
		}
		local().setItem(storageKey, encodeDrafts(drafts));
	} catch {
		blocked = true;
		report("Draft history is unavailable or malformed. Keep a copy; edits remain in this window.");
	}
	const memory = states.get(key);
	if (memory && Effect.runSync(Clock.currentTimeMillis) - memory.updatedAt >= DRAFT_AGE) {
		states.delete(key);
		report("A window draft expired after 30 days. Saved responses are unaffected.");
	}
	let current = states.get(key)
		?? drafts[key] ?? {
			author: "",
			body: "",
			id: `response.${crypto.randomUUID()}`,
			revision,
			type: "answer",
			updatedAt: Effect.runSync(Clock.currentTimeMillis),
		};
	if (current.revision !== revision) {
		report("Source changed since this draft. Your text is retained; review the new source and preview to bind it to this revision.");
	}
	function update(patch: Partial<Draft>) {
		current = { ...(states.get(key) ?? current), ...patch, updatedAt: Effect.runSync(Clock.currentTimeMillis) };
		states.set(key, current);
		try {
			if (blocked) {
				throw new Error("Unknown draft history");
			}
			const latest = readDrafts(local().getItem(storageKey), Effect.runSync(Clock.currentTimeMillis)).drafts;
			local().setItem(storageKey, encodeDrafts({ ...latest, [key]: current }));
		} catch {
			report("Draft could not be persisted (storage full or unavailable). Keep a copy; your text remains in this window.");
		}
		return current;
	}
	function clear() {
		try {
			local().removeItem(storageKey);
			blocked = false;
			states.clear();
			report("Workspace drafts cleared. Saved responses are unchanged; this visible text remains until you navigate away.");
		} catch {
			report("Draft storage could not be cleared.");
		}
	}
	function saved(pending: Draft) {
		if (states.get(key) !== pending) {
			const live = states.get(key);
			if (live?.id === pending.id) {
				update({ id: `response.${crypto.randomUUID()}` });
			}
			return false;
		}
		states.delete(key);
		try {
			const latest = readDrafts(local().getItem(storageKey), Effect.runSync(Clock.currentTimeMillis)).drafts;
			if (latest[key]?.id === pending.id) {
				delete latest[key];
			}
			local().setItem(storageKey, encodeDrafts(latest));
		} catch {
			report("Saved response confirmed, but its browser draft could not be cleared.");
		}
		current = { ...current, body: "", id: `response.${crypto.randomUUID()}`, updatedAt: Effect.runSync(Clock.currentTimeMillis) };
		return true;
	}
	return { clear, current: () => current, saved, update };
}
