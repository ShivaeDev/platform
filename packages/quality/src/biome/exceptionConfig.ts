import { randomUUID } from "node:crypto";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Schema } from "effect";
import ts from "typescript";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";

function nativeOverride(files: readonly string[], rule: string): unknown {
	const [, tool, group = "", name = ""] = rule.split("/");
	const key = tool === "lint" ? "linter" : "assist";
	const settings = tool === "lint" ? "rules" : "actions";
	return { includes: files, [key]: { [settings]: { [group]: { [name]: "off" } } } };
}

export function exceptionConfig(declarations: readonly ExceptionDeclaration[]): {
	readonly includes: readonly string[];
	readonly overrides: readonly unknown[];
} {
	const includes = declarations.filter((entry) => entry.rules.includes("biome/files/includes")).flatMap((entry) => entry.files);
	return {
		includes: includes.length === 0 ? [] : ["**", ...includes.filter((pattern) => pattern !== "**")],
		overrides: declarations.flatMap(({ files, rules }) =>
			rules.filter((rule) => /^biome\/(?:lint|assist)\//u.test(rule)).map((rule) => nativeOverride(files, rule)),
		),
	};
}

export async function withExceptionConfig<TValue>(
	root: string,
	declarations: readonly ExceptionDeclaration[],
	run: (args: readonly string[]) => Promise<TValue>,
): Promise<TValue> {
	const { includes, overrides } = exceptionConfig(declarations);
	if (includes.length === 0 && overrides.length === 0) {
		return run([]);
	}
	const name = `.quality-biome-${randomUUID()}.json`;
	const path = join(root, name);
	const config = await access(join(root, "biome.json")).then(
		() => "biome.json",
		() => "biome.jsonc",
	);
	const text = await readFile(join(root, config), "utf8");
	const parsed = ts.parseConfigFileTextToJson(config, text);
	if (parsed.error !== undefined) {
		throw new Error(`Cannot load ${config}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, " ")}`);
	}
	const own = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(parsed.config);
	const files = Schema.is(Schema.Record(Schema.String, Schema.Unknown))(own.files) ? own.files : {};
	if (
		(own.files !== undefined && !Schema.is(Schema.Record(Schema.String, Schema.Unknown))(own.files))
		|| (files.includes !== undefined && !Array.isArray(files.includes))
		|| (own.overrides !== undefined && !Array.isArray(own.overrides))
	) {
		throw new Error(`Cannot merge exceptions into invalid ${config}: files, includes or overrides has the wrong shape.`);
	}
	const previousIncludes = Array.isArray(files.includes) ? files.includes : ["**"];
	const previousOverrides = Array.isArray(own.overrides) ? own.overrides : [];
	const generated = {
		...own,
		files: { ...files, includes: [...previousIncludes, ...includes.filter((pattern) => pattern !== "**"), `!${name}`] },
		overrides: [...previousOverrides, ...overrides],
	};
	try {
		await writeFile(path, JSON.stringify(generated), { flag: "wx" });
		return await run([`--config-path=${path}`]);
	} finally {
		await rm(path, { force: true });
	}
}
