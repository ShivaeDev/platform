import { appendFileSync, cpSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { folder } from "./board.ts";
import { boardStory } from "./boardStory.ts";

export function sourceCheckout() {
	return boardStory.trait("project", "the checkout has current client source beside a stale browser bundle", function* (engine) {
		const original = fileURLToPath(new URL("../../", import.meta.url));
		const checkout = yield* Effect.acquireRelease(
			Effect.sync(() => folder({ "assets/react.js": "const staleBrowserBuild = true;" })),
			(value) => Effect.sync(value.remove),
		);
		for (const file of ["src", "package.json", "vite.config.ts"]) {
			cpSync(join(original, file), join(checkout.root, file), { recursive: true });
		}
		const config = JSON.parse(readFileSync(join(original, "tsconfig.json"), "utf8"));
		checkout.write("tsconfig.json", JSON.stringify({ ...config, extends: join(original, "../../tsconfig.base.json") }));
		symlinkSync(join(original, "node_modules"), join(checkout.root, "node_modules"), "dir");
		appendFileSync(join(checkout.root, "src/client/react/entry.tsx"), '\ndocument.documentElement.dataset.checkout = "current-checkout-browser";\n');
		engine.cliEntry = join(checkout.root, "src/server/cli.ts");
	});
}
