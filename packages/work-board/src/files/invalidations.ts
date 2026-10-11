import type { Changes } from "./changes.ts";

const trackers = new WeakMap<Changes, ReturnType<typeof trackInvalidations>>();
const LIMIT = 4096;

export function trackInvalidations() {
	let uncertain = 0;
	const paths = new Map<string, number>();
	return {
		record(revision: number, changed?: readonly string[]) {
			if (changed === undefined || paths.size + changed.length > LIMIT) {
				uncertain = revision;
				paths.clear();
			} else {
				for (const path of changed) {
					paths.set(path, revision);
				}
			}
		},
		since(revision: number): ReadonlySet<string> | undefined {
			return revision < uncertain ? undefined : new Set([...paths].filter(([, changed]) => changed > revision).map(([path]) => path));
		},
	};
}

export function registerInvalidations(changes: Changes, tracker: ReturnType<typeof trackInvalidations>) {
	trackers.set(changes, tracker);
}

export function invalidationsSince(changes: Changes, revision: number): ReadonlySet<string> | undefined {
	return trackers.get(changes)?.since(revision);
}
