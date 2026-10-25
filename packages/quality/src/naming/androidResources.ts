import { posix } from "node:path";

const RESOURCE_FOLDER =
	/^(?:anim|animator|color|drawable|font|interpolator|layout|menu|mipmap|navigation|raw|transition|values|xml)(?:-(?:[a-z0-9]+|r[A-Z]{2}|b\+[a-zA-Z0-9+]+))*$/u;

const RESOURCE_FILE = /^[a-z][a-z0-9_]*(?:\.9)?\.[a-z0-9]+$/u;

const CODE = /\.[cm]?[jt]sx?$/u;

function sourceSetOf(file: string, inventory: ReadonlySet<string>) {
	const match = /^(?<module>.*\/)?src\/(?<sourceSet>[^/]+)\/(?<relative>.*)$/u.exec(file);
	if (match?.groups === undefined) {
		return undefined;
	}
	const { module = "", sourceSet = "", relative = "" } = match.groups;
	return inventory.has(`${module}src/main/AndroidManifest.xml`) || inventory.has(`${module}src/${sourceSet}/AndroidManifest.xml`)
		? { folder: `${module}src/${sourceSet}`, name: sourceSet, relative }
		: undefined;
}

export function androidResources(files: readonly string[]) {
	const inventory = new Set(files);
	const folders = new Set<string>();
	const resources = new Set<string>();
	for (const file of files) {
		const sourceSet = sourceSetOf(file, inventory);
		if (sourceSet === undefined) {
			continue;
		}
		if (/^[a-z][a-zA-Z0-9]*$/u.test(sourceSet.name) && /^(?:java\/|kotlin\/|res\/|AndroidManifest\.xml$)/u.test(sourceSet.relative)) {
			folders.add(sourceSet.folder);
		}
		const [res, directory, name, ...nested] = sourceSet.relative.split("/");
		if (res !== "res" || directory === undefined || !RESOURCE_FOLDER.test(directory)) {
			continue;
		}
		folders.add(`${sourceSet.folder}/res/${directory}`);
		if (name !== undefined && nested.length === 0 && !CODE.test(name)) {
			resources.add(file);
		}
	}
	return {
		folders,
		messageFor: (path: string): string | undefined =>
			resources.has(path) && !RESOURCE_FILE.test(posix.basename(path))
				? `"${posix.basename(path)}" is an Android resource, so it is named in lower_snake_case, such as ic_launcher.png.`
				: undefined,
		owns: (path: string): boolean => resources.has(path),
	};
}
