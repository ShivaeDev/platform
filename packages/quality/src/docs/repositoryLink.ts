export interface Repository {
	readonly name: string;
	readonly owner: string;
}

export interface RepositoryLink {
	readonly anchor: string | undefined;
	readonly path: string;
}

const HOSTED = /github\.com[/:](?<owner>[\w.-]+)\/(?<name>[\w.-]+?)(?:\.git)?\/?$/u;

const SHORTHAND = /^(?:github:)?(?<owner>[\w.-]+)\/(?<name>[\w.-]+)$/u;

const TREE =
	/^https:\/\/(?:github\.com\/(?<owner>[\w.-]+)\/(?<name>[\w.-]+)\/(?:blob|tree|raw)|raw\.githubusercontent\.com\/(?<rawOwner>[\w.-]+)\/(?<rawName>[\w.-]+))\/(?<ref>[^/]+)\/(?<path>[^?#]*)(?:\?[^#]*)?(?:#(?<anchor>.*))?$/u;

const PINNED_REF = /^(?:[\da-f]{7,40}|v?\d+\.\d.*)$|@|%40/iu;

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;
}

export function repositoryOf(manifest: unknown): Repository | undefined {
	const declared = field(manifest, "repository");
	const url = typeof declared === "string" ? declared : field(declared, "url");
	if (typeof url !== "string") {
		return undefined;
	}
	const groups = (HOSTED.exec(url) ?? SHORTHAND.exec(url))?.groups;
	return groups?.owner === undefined || groups.name === undefined ? undefined : { name: groups.name, owner: groups.owner };
}

// A link pinned to a commit or a release tag shows that snapshot, so only links to a branch describe the current tree.
export function repositoryLink(url: string, repository: Repository | undefined): RepositoryLink | undefined {
	const groups = TREE.exec(url)?.groups;
	const owner = groups?.owner ?? groups?.rawOwner;
	const name = groups?.name ?? groups?.rawName;
	if (repository === undefined || groups === undefined || owner === undefined || name === undefined) {
		return undefined;
	}
	const same = owner.toLowerCase() === repository.owner.toLowerCase() && name.toLowerCase() === repository.name.toLowerCase();
	return same && !PINNED_REF.test(groups.ref ?? "") ? { anchor: groups.anchor, path: (groups.path ?? "").replace(/\/$/u, "") } : undefined;
}
