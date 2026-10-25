import { Effect, type FileSystem, PubSub, Stream } from "effect";
import { boardFilesystem, boardStory } from "./boardStory.ts";

export function directoryNotifications(onlyDirectories = false) {
	let notifications: PubSub.PubSub<FileSystem.WatchEvent> | undefined;
	let starts = 0;
	let watchedPaths: string[] = [];
	let listeners = 0;
	const source = Stream.unwrap(
		Effect.gen(function* () {
			if (!notifications) {
				return yield* Effect.die(new Error("The watcher notification source has not started"));
			}
			const subscription = yield* PubSub.subscribe(notifications);
			listeners += 1;
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					listeners -= 1;
				}),
			);
			return Stream.fromEffectRepeat(PubSub.take(subscription));
		}),
	);
	return {
		changed: (path: string) =>
			Effect.suspend(() => {
				if (!notifications || listeners === 0) {
					return Effect.die(new Error("No watcher stream is listening for directory notifications"));
				}
				const event: FileSystem.WatchEvent = { _tag: "Create", path };
				return PubSub.publish(notifications, event);
			}),
		trait: boardStory.traits(
			boardStory.trait("project", "the watcher can receive delayed directory notifications", function* () {
				starts = 0;
				watchedPaths = [];
				listeners = 0;
				notifications = yield* PubSub.unbounded<FileSystem.WatchEvent>();
			}),
			boardFilesystem((fs) => ({
				...fs,
				watch: (path, options) => {
					if (!options?.recursive) {
						return fs.watch(path, options);
					}
					starts += 1;
					watchedPaths.push(path);
					return onlyDirectories ? source : Stream.merge(fs.watch(path, options), source);
				},
			})),
		),
		watchedPaths: () => [...watchedPaths],
		watchStarts: () => starts,
	};
}
