import { type FileSystem, PubSub, Stream } from "effect";
import { boardStory } from "./boardStory.ts";

export function directoryNotifications(onlyDirectories = false) {
	let notifications: PubSub.PubSub<FileSystem.WatchEvent> | undefined;
	let starts = 0;
	return {
		changed: (path: string) => {
			if (!notifications) {
				throw new Error("The watcher notification source has not started");
			}
			const event: FileSystem.WatchEvent = { _tag: "Create", path };
			return PubSub.publish(notifications, event);
		},
		trait: boardStory.trait("project", "the watcher can receive delayed directory notifications", function* (engine) {
			starts = 0;
			notifications = yield* PubSub.unbounded<FileSystem.WatchEvent>();
			const events = notifications;
			engine.wrap = (fs) => ({
				...fs,
				watch: (path, options) => {
					if (!options?.recursive) {
						return fs.watch(path, options);
					}
					starts += 1;
					return onlyDirectories ? Stream.fromPubSub(events) : Stream.merge(fs.watch(path, options), Stream.fromPubSub(events));
				},
			});
		}),
		watchStarts: () => starts,
	};
}
