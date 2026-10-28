import { join, posix } from "node:path";
import { Effect, Result } from "effect";
import ts from "typescript";
import type { Finding } from "#rule.ts";
import type { MarkdownLine } from "./markdownLines.ts";
import { markdownLinks } from "./markdownLinks.ts";
import { type Repository, repositoryLink } from "./repositoryLink.ts";

export interface LinkContext {
	readonly anchors: (path: string) => Effect.Effect<ReadonlySet<string> | undefined>;
	readonly published: string | undefined;
	readonly repository: Repository | undefined;
	readonly root: string;
}

interface Destination {
	readonly anchor: string | undefined;
	readonly path: string;
}

const SCHEME = /^(?:[a-z][\d+.a-z-]*:|\/\/)/iu;

function decoded(text: string): string {
	return Result.getOrElse(
		Result.try(() => decodeURIComponent(text)),
		() => text,
	);
}

function destination(file: string, target: string, repository: Repository | undefined): Destination | undefined {
	if (SCHEME.test(target)) {
		const linked = repositoryLink(target, repository);
		return linked === undefined ? undefined : { anchor: linked.anchor, path: posix.normalize(decoded(linked.path) || ".") };
	}
	const hash = target.indexOf("#");
	const path = decoded(hash === -1 ? target : target.slice(0, hash));
	const anchor = hash === -1 ? undefined : target.slice(hash + 1);
	if (path === "") {
		return { anchor, path: file };
	}
	return { anchor, path: path.startsWith("/") ? posix.normalize(path.slice(1) || ".") : posix.join(posix.dirname(file), path) };
}

function inside(path: string, directory: string): boolean {
	return path === directory || path.startsWith(`${directory}/`);
}

function exampleUrl(repository: Repository | undefined, to: Destination): string {
	const anchor = to.anchor === undefined ? "" : `#${to.anchor}`;
	return repository === undefined ? "" : `, such as https://github.com/${repository.owner}/${repository.name}/blob/HEAD/${to.path}${anchor}`;
}

function placement(context: LinkContext, target: string, to: Destination): string | undefined {
	if (to.path === ".." || to.path.startsWith("../")) {
		return `"${target}" leaves the repository. Link to a file inside it, or use an absolute URL.`;
	}
	const absolute = join(context.root, to.path);
	if (!(ts.sys.fileExists(absolute) || ts.sys.directoryExists(absolute))) {
		return `"${target}" links to ${to.path}, which does not exist. Link to the file's current path, or remove the link.`;
	}
	if (context.published !== undefined && !SCHEME.test(target) && !inside(to.path, context.published)) {
		return `"${target}" leaves its package, and npm shows ${context.published}/README.md without the repository around it. Use an absolute URL${exampleUrl(context.repository, to)}.`;
	}
	return undefined;
}

function problem(context: LinkContext, target: string, to: Destination): Effect.Effect<string | undefined> {
	const misplaced = placement(context, target, to);
	const anchor = to.anchor;
	if (misplaced !== undefined || anchor === undefined || anchor === "" || !to.path.endsWith(".md")) {
		return Effect.succeed(misplaced);
	}
	return Effect.map(context.anchors(to.path), (anchors) =>
		anchors === undefined || anchors.has(decoded(anchor).toLowerCase())
			? undefined
			: `"${target}" links to the heading #${anchor}, which ${to.path} does not have. Link to a current heading; GitHub forms its anchor from the heading text.`,
	);
}

export function linkFindings(context: LinkContext, file: string, lines: readonly MarkdownLine[]): Effect.Effect<readonly Finding[]> {
	return Effect.map(
		Effect.forEach(markdownLinks(lines), (link) => {
			const to = destination(file, link.target, context.repository);
			return Effect.map(to === undefined ? Effect.succeed(undefined) : problem(context, link.target, to), (message): readonly Finding[] =>
				message === undefined ? [] : [{ file, line: link.line, message, subject: link.target }],
			);
		}),
		(findings) => findings.flat(),
	);
}
