import { Result } from "effect";
import { expect, it } from "vitest";
import { parseRepositoryAddress } from "#repositoryAddress.ts";

it.each([
	["example/project", "shorthand"],
	["github:example/project", "shorthand"],
	["example/project.git", "shorthand"],
	["github:example/project.git", "shorthand"],
	["https://github.com/example/project", "remote"],
	["https://github.com/example/project.git/", "remote"],
	["http://github.com/example/project.git", "remote"],
	["git+https://github.com/example/project.git", "remote"],
	["git+http://github.com/example/project.git", "remote"],
	["git@github.com:example/project.git", "remote"],
	["ssh://git@github.com/example/project.git", "remote"],
	["git+ssh://git@github.com/example/project.git", "remote"],
	["git://github.com/example/project.git", "remote"],
	["  https://github.com/example/project\n", "remote"],
])("parses repository address %s", (address, kind) => {
	expect(parseRepositoryAddress(address)).toEqual(
		Result.succeed({ kind, name: "project", number: undefined, owner: "example", repository: "example/project" }),
	);
});

it("preserves repository spelling and punctuation", () => {
	expect(parseRepositoryAddress("https://github.com/Example-Team/My_project.name.git")).toEqual(
		Result.succeed({ kind: "remote", name: "My_project.name", number: undefined, owner: "Example-Team", repository: "Example-Team/My_project.name" }),
	);
});

it.each([1, 42, 123_456])("parses pull request number %s", (number) => {
	expect(parseRepositoryAddress(`https://github.com/example/project/pull/${number}`)).toEqual(
		Result.succeed({ kind: "pull-request", name: "project", number, owner: "example", repository: "example/project" }),
	);
});

it.each([
	"",
	"project",
	"https://gitlab.com/example/project",
	"https://github.com.example.org/example/project/pull/1",
	"https://example.org/example/project/pull/1",
	"https://github.com@other.example/example/project/pull/1",
	"git@other.example:example/project.git",
	"https://github.com:example/project",
	"git@github.com/example/project",
	"https://github.com/example/.",
	"https://github.com/example/..",
	"https://github.com/../project",
	"https://github.com/example/project/issues/1",
	"https://github.com/example/project/tree/main",
	"http://github.com/example/project/pull/1",
	"example/project/pull/1",
	"https://github.com/example/project/pull/0",
	"https://github.com/example/project/pull/01",
	"https://github.com/example/project/pull/-1",
	"https://github.com/example/project/pull/1.5",
	"https://github.com/example/project/pull/nope",
	"https://github.com/example/project/pull/9007199254740993",
	"https://github.com/example/project/pull/1/files",
	"https://github.com/example/project/pull/1?tab=files",
	"https://github.com/example/project/pull/1#discussion",
])("returns a typed failure for %s", (address) => {
	expect(parseRepositoryAddress(address)).toMatchObject({ _tag: "Failure", failure: { _tag: "GitHubAddressInvalid" } });
});
