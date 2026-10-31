import { createWriteStream } from "node:fs";
import { registerHooks } from "node:module";
import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { codeDigest } from "./codeDigest.ts";
import { packageManifest } from "./installedCode.ts";

const entryManifest = new URL(import.meta.url).searchParams.get("manifest");
if (entryManifest !== null) {
	const argument = process.execArgv.indexOf(import.meta.url);
	process.execArgv.splice(argument - 1, 2);
	const output = createWriteStream("", { autoClose: false, fd: 3 });
	const reported = new Set<string>();
	function report(file: string, directory = dirname(file)) {
		if (!reported.has(file)) {
			reported.add(file);
			output.write(`${JSON.stringify({ digest: codeDigest(file), directory, file })}\n`);
		}
	}
	report(entryManifest, dirname(dirname(entryManifest)));
	// Preloads run before hooks can observe their imports.
	const extension = new URL(import.meta.url).pathname.endsWith(".ts") ? "ts" : "js";
	for (const url of [
		import.meta.url,
		new URL(`./codeDigest.${extension}`, import.meta.url),
		new URL(`./installedCode.${extension}`, import.meta.url),
	]) {
		report(fileURLToPath(url));
	}
	registerHooks({
		load(url, context, nextLoad) {
			if (url.startsWith("file:")) {
				report(fileURLToPath(url));
			}
			return nextLoad(url, context);
		},
		resolve(specifier, context, nextResolve) {
			const resolved = nextResolve(specifier, context);
			if (resolved.url.startsWith("file:") && context.parentURL?.startsWith("file:") && /^[\w@][^:]*$/u.test(specifier)) {
				const name = specifier
					.split("/")
					.slice(0, specifier.startsWith("@") ? 2 : 1)
					.join("/");
				const manifest = packageManifest(name, fileURLToPath(context.parentURL));
				report(manifest, dirname(dirname(manifest)));
			}
			return resolved;
		},
	});
}
