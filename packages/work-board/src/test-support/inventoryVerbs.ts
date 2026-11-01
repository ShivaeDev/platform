import { Effect } from "effect";
import { servingObservations } from "./servingObservations.ts";
import type { BoardEngine } from "./storyEngine.ts";

export const directoryDenials = new WeakMap<BoardEngine, Set<string>>();
const denied = directoryDenials;

export function inventoryVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		denyDirectory: (relative: string) =>
			Effect.sync(() => {
				tell(`the filesystem refuses to list ${relative}`);
				const paths = denied.get(engine);
				if (!paths) {
					throw new Error("No directory access boundary was prepared");
				}
				paths.add(`${engine.notes.root}/${relative}`);
			}),
		notifyDirectory: (relative: string) =>
			Effect.suspend(() => {
				tell(`the filesystem reports a change to ${relative}`);
				const notifications = servingObservations(engine).notifications;
				if (!notifications) {
					throw new Error("No directory notifications were prepared");
				}
				return Effect.asVoid(notifications.changed(relative));
			}),
		restoreDirectory: (relative: string) =>
			Effect.sync(() => {
				tell(`the filesystem allows listing ${relative} again`);
				const paths = denied.get(engine);
				if (!paths?.delete(`${engine.notes.root}/${relative}`)) {
					throw new Error(`The directory ${relative} was not denied`);
				}
			}),
	};
}
