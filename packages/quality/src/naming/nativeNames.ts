import { posix } from "node:path";
import { androidResources } from "./androidResources.ts";

const BUNDLE = /\.(?:xcodeproj|xcworkspace|xcassets)$/u;

const CATALOG = /(?:^|\/)[^/]+\.xcassets\//u;

const CODE = /\.[cm]?[jt]sx?$/u;

function localisationFolders(files: readonly string[], projects: ReadonlySet<string>): readonly string[] {
	const folders = new Set<string>();
	for (const file of files) {
		for (let folder = posix.dirname(file); folder !== "."; folder = posix.dirname(folder)) {
			if (folder.endsWith(".lproj") && [...projects].some((project) => folder.startsWith(`${project}/`))) {
				folders.add(folder);
			}
		}
	}
	return [...folders];
}

function xcodeFolders(files: readonly string[]): ReadonlySet<string> {
	const folders = new Set<string>();
	const projects = new Set<string>();
	for (const file of files) {
		for (let folder = posix.dirname(file); folder !== "."; folder = posix.dirname(folder)) {
			if (BUNDLE.test(folder) || CATALOG.test(`${folder}/`)) {
				folders.add(folder);
			}
			if (folder.endsWith(".xcodeproj")) {
				const parent = posix.dirname(folder);
				folders.add(parent);
				const source = posix.join(parent, posix.basename(folder, ".xcodeproj"));
				folders.add(source);
				projects.add(source);
			}
		}
	}
	return new Set([...folders, ...localisationFolders(files, projects)]);
}

function swiftFolders(files: readonly string[]): ReadonlySet<string> {
	const packages = new Set(files.filter((file) => posix.basename(file) === "Package.swift").map((file) => posix.dirname(file)));
	const folders = new Set<string>(packages);
	for (const file of files) {
		for (const root of packages) {
			const sources = posix.join(root, "Sources");
			if (file.startsWith(`${sources}/`)) {
				folders.add(sources);
				const target = file.slice(sources.length + 1).split("/")[0];
				if (target !== undefined && file.slice(sources.length + 1).includes("/")) {
					folders.add(`${sources}/${target}`);
				}
			}
		}
	}
	return folders;
}

export function nativeNames(files: readonly string[]) {
	const android = androidResources(files);
	return {
		folders: new Set([...xcodeFolders(files), ...swiftFolders(files), ...android.folders]),
		messageFor: android.messageFor,
		owns: (path: string): boolean =>
			!CODE.test(path)
			&& (android.owns(path)
				|| CATALOG.test(path)
				|| (posix.basename(path) === "Contents.json" && /(?:^|\/)[^/]+\.(?:xcodeproj|xcworkspace)\//u.test(path))),
	};
}
