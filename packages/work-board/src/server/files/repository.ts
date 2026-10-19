import { Effect, FileSystem, Option, Path, Schema } from "effect";

const GITHUB = /^(?:git\+)?(?:https?:\/\/|ssh:\/\/git@|git:\/\/|git@)github\.com[/:](?<owner>[\w.-]+)\/(?<name>[\w.-]+?)(?:\.git)?\/?$/u;
const SHORTHAND = /^(?:github:)?(?<owner>[\w.-]+)\/(?<name>[\w.-]+)$/u;
const ORIGIN = /\[remote "origin"\][^[]*?^\s*url\s*=\s*(?<url>\S+)/mu;
const Manifest = Schema.Struct({
	repository: Schema.optional(Schema.Union([Schema.String, Schema.Struct({ url: Schema.String })])),
});

export function pullRequestBase(repository: string): string | undefined {
	const match = GITHUB.exec(repository.trim()) ?? SHORTHAND.exec(repository.trim());
	const { owner, name } = match?.groups ?? {};
	return owner && name ? `https://github.com/${owner}/${name}/pull/` : undefined;
}

// The nearest package.json repository wins, then the enclosing git checkout's origin remote; only GitHub has a known pull request URL.
export const repositoryPulls = Effect.fn("WorkBoard.repositoryPulls")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	function read(file: string) {
		return fs.readFileString(file).pipe(Effect.option);
	}
	for (let directory = path.resolve(root); ; directory = path.dirname(directory)) {
		const manifest = Option.flatMap(yield* read(path.join(directory, "package.json")), (source) =>
			Schema.decodeUnknownOption(Schema.fromJsonString(Manifest))(source),
		);
		const declared = Option.getOrUndefined(manifest)?.repository;
		if (declared !== undefined) {
			return pullRequestBase(typeof declared === "string" ? declared : declared.url);
		}
		const git = path.join(directory, ".git");
		if (yield* fs.exists(git).pipe(Effect.orElseSucceed(() => false))) {
			return yield* originPulls(git);
		}
		if (path.dirname(directory) === directory) {
			return undefined;
		}
	}
});

const originPulls = Effect.fn("WorkBoard.originPulls")(function* (git: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	function read(file: string) {
		return fs.readFileString(file).pipe(Effect.option, Effect.map(Option.getOrUndefined));
	}
	const pointer = /^gitdir:\s*(?<dir>.+)$/mu.exec((yield* read(git)) ?? "")?.groups?.dir?.trim();
	const directory = pointer === undefined ? git : path.resolve(path.dirname(git), pointer);
	const common = (yield* read(path.join(directory, "commondir")))?.trim();
	const config = yield* read(path.join(common ? path.resolve(directory, common) : directory, "config"));
	const url = ORIGIN.exec(config ?? "")?.groups?.url;
	return url === undefined ? undefined : pullRequestBase(url);
});
