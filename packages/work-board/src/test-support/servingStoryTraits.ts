import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect, PlatformError } from "effect";
import { boardStory } from "./boardStory.ts";
import { bundleBoard } from "./bundleBoard.ts";
import { directoryNotifications } from "./directoryNotifications.ts";
import { countingPaths, faultyWatch, silentWatch } from "./faults.ts";
import { growBeforeRead } from "./fileRaces.ts";
import { homeLinks } from "./homeLinks.ts";
import { imageNamedDirectory as makeImageNamedDirectory, screenshotFile } from "./imageFixtures.ts";
import { referenceLink } from "./referenceLink.ts";
import { attachServer } from "./servingEngine.ts";
import { type LinkTarget, linkedRoots, resolvedTarget } from "./servingLinks.ts";
import { servingObservations } from "./servingObservations.ts";
import { wrapFilesystem } from "./storyEngine.ts";

export function filesystemIgnoresCase() {
	const probe = mkdtempSync(join(tmpdir(), "work-board-case-"));
	try {
		writeFileSync(join(probe, "probe.md"), "");
		return existsSync(join(probe, "PROBE.md"));
	} finally {
		rmSync(probe, { force: true, recursive: true });
	}
}

export function unreadableFile(name: string) {
	return boardStory.trait("project", `the board is denied permission to read ${name}`, (engine) => {
		wrapFilesystem(engine, (fs) => ({
			...fs,
			readFileString: (file, options) =>
				file.endsWith(name)
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
		}));
	});
}

export function identityChangesAfterIndexing(file: string, from: string, to: string) {
	return boardStory.trait("project", `${file} declares ${to} instead of ${from} from its second read on`, (engine) => {
		let reads = 0;
		wrapFilesystem(engine, (fs) => ({
			...fs,
			readFileString: (path, options) =>
				fs.readFileString(path, options).pipe(
					Effect.map((source) => {
						if (!path.endsWith(file)) {
							return source;
						}
						reads += 1;
						return reads > 1 ? source.replace(`id: ${from}`, `id: ${to}`) : source;
					}),
				),
		}));
	});
}

export const directoryReadsRecorded = boardStory.trait(
	"project",
	"the workspace records every path the board visits and every folder it lists",
	(engine) => {
		const paths = countingPaths();
		servingObservations(engine).paths = paths;
		wrapFilesystem(engine, paths.wrap);
	},
);

export const fileReadsCounted = boardStory.trait("project", "the workspace counts every file the board reads", (engine) => {
	const observations = servingObservations(engine);
	observations.fileReads = 0;
	wrapFilesystem(engine, (fs) => ({
		...fs,
		readFileString: (path, options) =>
			fs.readFileString(path, options).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						observations.fileReads = (observations.fileReads ?? 0) + 1;
					}),
				),
			),
	}));
});

export const watchCanFail = boardStory.trait("project", "the board's file watch can be made to fail and recover", (engine) => {
	const watch = faultyWatch();
	servingObservations(engine).watch = watch;
	wrapFilesystem(engine, watch.wrap);
});

export function bundleNotBuilt(asset: string) {
	return boardStory.trait("project", `the board serves ${asset} from a local build that has not run yet`, function* (engine) {
		engine.manualServing = true;
		const board = yield* bundleBoard(engine.notes.root, [asset]);
		servingObservations(engine).logged = board.logged;
		yield* attachServer(engine, board);
	});
}

export const homeLinksOutside = boardStory.trait("project", "home-link.md is a symlink to a file outside the workspace", (engine) => {
	if (!engine.outside) {
		throw new Error("No outside folder was prepared");
	}
	homeLinks.outside(engine.notes.root, engine.outside.root);
});

export const planAliases = boardStory.trait("project", "alias.md is a symlink to plan.md and a-copy.md a hard link to it", (engine) =>
	homeLinks.aliases(engine.notes.root),
);

export const hiddenPlanCopy = boardStory.trait("project", "alias.md is a symlink to plan.md and .drafts/plan-copy.md a hard link to it", (engine) =>
	homeLinks.nestedAlias(engine.notes.root),
);

export function workspaceLink(path: string, target: LinkTarget) {
	return boardStory.trait("project", `${path} in the workspace links to ${target}`, (engine) => {
		referenceLink(engine.notes, path, resolvedTarget(engine, target));
	});
}

export function referenceLinkTo(path: string, target: LinkTarget) {
	return boardStory.trait("project", `${path} in the reference folder links to ${target}`, (engine) => {
		referenceLink(linkedRoots(engine).reference, path, resolvedTarget(engine, target));
	});
}

export function referenceFile(file: string, source: string) {
	return boardStory.trait("project", `the reference folder holds ${file}`, (engine) => {
		linkedRoots(engine).reference.write(file, source);
	});
}

export const privateImageBesideWorkspace = boardStory.trait("project", "private.png sits in the folder that holds the workspace", (engine) => {
	writeFileSync(join(dirname(engine.notes.root), "private.png"), "private");
});

export const imageNamedDirectory = boardStory.trait("project", "screenshot.png is a directory", (engine) => {
	makeImageNamedDirectory(engine.notes.root);
});

export const growingScreenshot = boardStory.trait(
	"project",
	"screenshot.png grows past 16 MiB between the board's size check and its read",
	(engine) => {
		wrapFilesystem(engine, growBeforeRead(screenshotFile(engine.notes.root), 16 * 1024 * 1024 + 1));
	},
);

export const watchBlind = boardStory.trait("project", "the board's file watch reports readiness but no file changes", (engine) => {
	wrapFilesystem(engine, silentWatch);
});

export function directoryNotificationsDelivered() {
	const notifications = directoryNotifications(true);
	return boardStory.traits(
		notifications.trait,
		boardStory.trait("project", "the story can deliver directory notifications to the board's watcher", (engine) => {
			servingObservations(engine).notifications = notifications;
		}),
	);
}

export function homeRefusal(home: string) {
	return `refused: The home file ${home} is not a markdown file in <workspace>. Choose an existing Markdown file with --home.`;
}
