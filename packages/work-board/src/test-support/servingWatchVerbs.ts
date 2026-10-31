import { readFileSync, renameSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { Effect, Exit, Option, Result, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { fileUrl } from "#files/url.ts";
import { subscribe } from "./nativeRpc.ts";
import { referenceLink } from "./referenceLink.ts";
import { bodyOf, failureMessage, servingBoardReads } from "./servingBoardReads.ts";
import { type LinkTarget, resolvedTarget } from "./servingLinks.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function servingWatchVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { documentAt, linked, changeSeen, shows, gone, linkShows, watching, watchTurns, notifications, watch } = servingBoardReads(engine, tell);
	const mounted = new Map<string, ReturnType<ReturnType<typeof served>["client"]["api"]["document"]["query"]>>();
	let announcements: Effect.Success<ReturnType<typeof subscribe>> | undefined;
	return {
		linkWatched: (path: string, target: LinkTarget, file: string) =>
			changeSeen(
				`an outside process links ${path} to ${target}`,
				() => referenceLink(engine.notes, path, resolvedTarget(engine, target)),
				linkShows(path, target, file),
			),
		listenForChanges: Effect.fn("Story.listenForChanges")(function* () {
			tell("a live reader listens for the board's change announcements");
			announcements = yield* subscribe(served(engine).board);
			yield* announcements.next();
		}),
		nextAnnouncement: () => {
			tell("the live reader waits for the board's next announcement");
			if (!announcements) {
				throw new Error("Call listenForChanges before waiting for an announcement");
			}
			return Effect.map(announcements.next(), (hint) => (hint._tag === "Resync" ? "resync" : "changed"));
		},
		nextItemSource: (url: string) => {
			tell(`the reader waits for the mounted read of ${url} to change`);
			const query = mounted.get(url);
			if (!query) {
				throw new Error(`Call watchItem(${url}) before waiting for its next read`);
			}
			const { registry } = served(engine).client;
			const before = registry.get(query);
			const shown = AsyncResult.isSuccess(before) ? before.value.source : undefined;
			return AtomRegistry.toStream(registry, query).pipe(
				Stream.filterMap((read) =>
					AsyncResult.isSuccess(read) && !read.waiting && read.value.source !== shown ? Result.succeed(read.value.source) : Result.failVoid,
				),
				Stream.runHead,
				Effect.map(Option.getOrThrow),
			);
		},
		notificationOutcome: (path: string) => {
			tell(`the story notifies the board's watcher that ${path} changed`);
			return Effect.exit(notifications().changed(path)).pipe(
				Effect.map((sent) => (Exit.isFailure(sent) ? `refused: ${failureMessage(sent.cause)}` : "delivered")),
			);
		},
		notifiedFolders: () =>
			Effect.sync(() => {
				tell("the reader lists the folders the board subscribed to directory notifications for");
				return notifications()
					.watchedPaths()
					.map((path) => (path === engine.notes.root ? "the workspace" : relative(engine.notes.root, path)));
			}),
		notifyChange: (path: string) =>
			changeSeen(
				`the story notifies the board's watcher that ${path} changed`,
				Effect.suspend(() => notifications().changed(path)),
				Effect.map(documentAt(fileUrl(path)), (read) => read === bodyOf(readFileSync(join(engine.notes.root, path), "utf8"))),
			),
		removeFromReference: (file: string) =>
			changeSeen(
				`an outside editor removes ${file} from the reference folder`,
				() => rmSync(join(linked().reference.root, file)),
				gone(`/reference/${file}`),
			),
		removeWatched: (path: string) =>
			changeSeen(`an outside editor removes ${path}`, () => rmSync(join(engine.notes.root, path)), gone(fileUrl(path))),
		renameInReference: (from: string, to: string) =>
			changeSeen(
				`an outside editor renames ${from} to ${to} in the reference folder`,
				() => renameSync(join(linked().reference.root, from), join(linked().reference.root, to)),
				Effect.map(Effect.all([gone(`/reference/${from}`), gone(`/reference/${to}`)]), ([left, missing]) => left && !missing),
			),
		renameWatched: (from: string, to: string) =>
			changeSeen(
				`an outside editor renames ${from} to ${to}`,
				() => renameSync(join(engine.notes.root, from), join(engine.notes.root, to)),
				Effect.map(Effect.all([gone(fileUrl(from)), gone(fileUrl(to))]), ([left, missing]) => left && !missing),
			),
		replaceWithLink: (path: string, target: LinkTarget) => {
			tell(`an outside process replaces ${path} with a link to ${target}`);
			rmSync(join(engine.notes.root, path));
			referenceLink(engine.notes, path, resolvedTarget(engine, target));
		},
		retargetLink: (path: string, target: LinkTarget, file: string) =>
			changeSeen(
				`an outside process points ${path} at ${target}`,
				() => {
					rmSync(join(engine.notes.root, path));
					referenceLink(engine.notes, path, resolvedTarget(engine, target));
				},
				linkShows(path, target, file),
			),
		watchFails: () => watchTurns("the board's file watch fails", () => watch().fail(), false),
		watchItem: Effect.fn("Story.watchItem")(function* (url: string) {
			tell(`the reader mounts a live read of ${url}`);
			const { client } = served(engine);
			const query = client.api.document.query({ url });
			mounted.set(url, query);
			yield* Effect.acquireRelease(
				Effect.sync(() => client.registry.mount(query)),
				(release) => Effect.sync(release),
			);
			const document = yield* Effect.promise(() => client.read(query));
			yield* AtomRegistry.toStream(client.registry, client.updates.status).pipe(
				Stream.takeUntil((status) => status.connection === "live"),
				Stream.runDrain,
			);
			return document.source;
		}),
		watchRecovers: () =>
			watchTurns(
				"the board's file watch becomes available again",
				() =>
					Effect.sync(() => {
						watch().heal();
					}),
				true,
			),
		watchStatus: () => {
			tell("the reader asks whether the board is watching its files");
			return Effect.map(watching(), (on) => (on ? "watching" : "not watching"));
		},
		writeInReference: (file: string, source: string) =>
			changeSeen(
				`an outside editor writes ${file} in the reference folder`,
				() => linked().reference.write(file, source),
				shows(`/reference/${file}`, source),
			),
		writeInReplacement: (file: string, source: string, seenAt: string) =>
			changeSeen(
				`an outside editor writes ${file} in the replacement folder`,
				() => linked().replacement.write(file, source),
				shows(`/${seenAt}/${file}`, source),
			),
		writeWatched: (path: string, source: string, seenAt = path) =>
			changeSeen(`an outside editor writes ${path}`, () => engine.notes.write(path, source), shows(fileUrl(seenAt), source)),
	};
}
