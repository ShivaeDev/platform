import { dirname, join } from "node:path";
import { FileSystem } from "effect";
import { app } from "./app.ts";

export function documentationFixture(markdown: string, source = "docs/framework/add-a-feature.md") {
	return app.trait("source", `the documentation in ${source} describes these imports`, function* ({ root }) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.makeDirectory(dirname(join(root, source)), { recursive: true });
		yield* fs.writeFileString(join(root, source), markdown);
	});
}
