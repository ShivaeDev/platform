import { type FileSystem, PubSub, Stream } from "effect";
import { boardStory } from "./boardStory.ts";

export function directoryNotifications() {
	let notifications: PubSub.PubSub<FileSystem.WatchEvent> | undefined;
	return {
		changed: (path: string) => {
			if (!notifications) {
				throw new Error("The watcher notification source has not started");
			}
			const event: FileSystem.WatchEvent = { _tag: "Create", path };
			return PubSub.publish(notifications, event);
		},
		trait: boardStory.trait("project", "the watcher can receive delayed directory notifications", function* (engine) {
			notifications = yield* PubSub.unbounded<FileSystem.WatchEvent>();
			const events = notifications;
			engine.wrap = (fs) => ({
				...fs,
				watch: (path, options) => (options?.recursive ? Stream.merge(fs.watch(path, options), Stream.fromPubSub(events)) : fs.watch(path, options)),
			});
		}),
	};
}
