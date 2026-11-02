import { expect } from "vitest";
import { apiPaths } from "#test/apiPaths.ts";

for (const base of ["", "/", "/api/v3", "/api/v3/"] as const) {
	const prefix = base.replace(/\/$/u, "");
	const description = base || "an origin without a path";

	apiPaths.it(
		`a repository read at ${description} keeps the base path through App discovery and token exchange`,
		[],
		function* ({ readPull, requests }) {
			yield* readPull(base);

			expect(yield* requests(base)).toEqual([
				`GET ${prefix}/repos/acme/widgets/installation 200`,
				`POST ${prefix}/app/installations/7/access_tokens 200`,
				`GET ${prefix}/repos/acme/widgets/pulls/1 200`,
			]);
		},
	);

	apiPaths.it(
		`an App list at ${description} keeps its query and follows the prefixed next Link once`,
		[],
		function* ({ listInstallations, requests }) {
			yield* listInstallations(base);

			expect(yield* requests(base)).toEqual([`GET ${prefix}/app/installations?per_page=1 200`, `GET ${prefix}/app/installations?page=2 200`]);
		},
	);

	apiPaths.it(`a write at ${description} reaches the issue under the base path`, [], function* ({ writeLabels, requests }) {
		yield* writeLabels(base);

		expect((yield* requests(base)).at(-1)).toBe(`PUT ${prefix}/repos/acme/widgets/issues/1/labels 200`);
	});

	for (const format of ["text", "bytes"] as const) {
		apiPaths.it(`a ${format} read at ${description} reaches the pull under the base path`, [], function* ({ readRaw, requests }) {
			yield* readRaw(base, format);

			expect((yield* requests(base)).at(-1)).toBe(`GET ${prefix}/repos/acme/widgets/pulls/1 200`);
		});
	}

	apiPaths.it(
		`an artifact download at ${description} uses the base path for GitHub and the exact storage redirect`,
		[],
		function* ({ downloadArchive, requests }) {
			yield* downloadArchive(base);

			expect((yield* requests(base)).slice(-2)).toEqual([
				`GET ${prefix}/repos/acme/widgets/actions/artifacts/7/zip 302`,
				"GET /storage/archive.zip?signature=storage-secret 200",
			]);
		},
	);
}

for (const path of ["relative", "absolute"] as const) {
	apiPaths.it(
		`${path === "absolute" ? "an" : "a"} ${path} representation path reaches the prefixed resource without duplicating the prefix`,
		[],
		function* ({ readPull, requests }) {
			yield* readPull("/api/v3", path);

			expect((yield* requests("/api/v3")).at(-1)).toBe("GET /api/v3/repos/acme/widgets/pulls/1 200");
		},
	);
}
