import * as NodePath from "@effect/platform-node/NodePath";
import { Console, Effect, FileSystem, Path } from "effect";
import type { ResolvedConfig } from "#config/load.ts";
import { scan } from "#engine/session.ts";
import { SetupFailure } from "#failure.ts";
import { plural } from "#report/plural.ts";
import type { RuleServices } from "#rule.ts";

export const fixAscii = Effect.fn("Cli.fixAscii")(function* (config: ResolvedConfig): Effect.fn.Return<void, SetupFailure, RuleServices> {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));
	const rules = config.active.filter((rule) => rule.id === "files/ascii");
	const findings = (yield* scan({ ...config, active: rules })).violations;
	const fixes = findings.flatMap((finding) => (finding.fix === undefined ? [] : [{ file: finding.file, ...finding.fix }]));
	const fs = yield* FileSystem.FileSystem;
	let changed = 0;
	for (const file of new Set(fixes.map((fix) => fix.file))) {
		const fileFixes = fixes.filter((fix) => fix.file === file);
		const bytes = yield* fs.readFile(join(config.root, file)).pipe(Effect.mapError((cause) => new SetupFailure({ cause, message: cause.message })));
		const original = new TextDecoder("utf-8", { "ignoreBOM": true }).decode(bytes);
		const text = fileFixes
			.sort((left, right) => right.start - left.start)
			.reduce((current, fix) => `${current.slice(0, fix.start)}${fix.replacement}${current.slice(fix.end)}`, original);
		if (text !== original) {
			yield* fs.writeFileString(join(config.root, file), text).pipe(Effect.mapError((cause) => new SetupFailure({ cause, message: cause.message })));
			changed += 1;
		}
	}
	yield* Console.log(`quality: files/ascii rewrote ${plural(changed, "file")}.`);
});
