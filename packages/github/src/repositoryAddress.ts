import { Result } from "effect";
import { GitHubAddressInvalid } from "#errors.ts";

export interface RepositoryAddress {
	readonly kind: "remote" | "shorthand" | "pull-request";
	readonly name: string;
	readonly number: number | undefined;
	readonly owner: string;
	readonly repository: string;
}

const REPOSITORY =
	/^(?:(?<remote>(?:git\+)?(?:https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git:\/\/github\.com\/|git@github\.com:))|github:)?(?<owner>[A-Za-z0-9-]+)\/(?<name>[\w.-]+?)(?:\.git)?\/?$/u;
const PULL_REQUEST = /^https:\/\/github\.com\/(?<owner>[A-Za-z0-9-]+)\/(?<name>[\w.-]+)\/pull\/(?<number>[1-9]\d*)$/u;

export function parseRepositoryAddress(address: string): Result.Result<RepositoryAddress, GitHubAddressInvalid> {
	const input = address.trim();
	const groups = (PULL_REQUEST.exec(input) ?? REPOSITORY.exec(input))?.groups;
	const owner = groups?.owner;
	const name = groups?.name;
	const number = groups?.number === undefined ? undefined : Number(groups.number);
	if (owner === undefined || name === undefined || name === "." || name === ".." || (number !== undefined && !Number.isSafeInteger(number))) {
		return Result.fail(new GitHubAddressInvalid({}));
	}
	let kind: RepositoryAddress["kind"] = "shorthand";
	if (number !== undefined) {
		kind = "pull-request";
	} else if (groups?.remote !== undefined) {
		kind = "remote";
	}
	return Result.succeed({ kind, name, number, owner, repository: `${owner}/${name}` });
}
