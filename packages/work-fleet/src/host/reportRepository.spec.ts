import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { reportRemote, reportRepositories } from "#test/reportRepository.ts";

for (const url of [
	"https://github.com/example/project.git",
	"git@github.com:example/project.git",
	"ssh://git@github.com/example/project.git",
	"git+https://github.com/example/project.git",
]) {
	reportRepositories.it(`report publication uses the GitHub remote ${url}`, [reportRemote(url)], function* (repository) {
		expect(yield* repository.read()).toBe("example/project");
	});
}

for (const url of ["https://gitlab.com/example/project.git", "example/project", "github:example/project"]) {
	reportRepositories.it(`report publication refuses the non-GitHub remote ${url}`, [reportRemote(url)], function* (repository) {
		expect(yield* repository.read().pipe(Effect.flip)).toMatchObject({
			_tag: "ServiceUnavailable",
			message: "Report publication checks need a GitHub remote",
		});
	});
}
