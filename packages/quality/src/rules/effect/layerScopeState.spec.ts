import { expect } from "@effect/vitest";
import { serviceModel } from "#rules/effect/serviceModel.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { ownedServiceFiles } from "#test/ownedServiceFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceResolves } from "#test/serviceModelFiles.ts";

for (const captured of [false, true]) {
	ruleStory.it(
		`service model ${captured ? "rejects an injected service beside" : "accepts"} its Layer scope and private Ref closures`,
		[
			effectResolves(),
			serviceResolves(),
			repositoryHas(
				...ownedServiceFiles(captured).map((file) => ({
					...file,
					content: file.content
						.replace("yield* Scope.make()", "yield* Scope.Scope")
						.replace(
							"requires: [Store, Settings, OptionalSettings, Prefix, Subject, SqlClient.SqlClient, HttpClient.HttpClient]",
							captured ? "requires: [Store]" : "requires: []",
						),
				})),
			),
		],
		function* ({ check }) {
			expect(yield* check(serviceModel)).toEqual(
				captured ? [expect.objectContaining({ message: expect.stringContaining("Initializer state carries a dependency.") })] : [],
			);
		},
	);
}
