import bcd from "@mdn/browser-compat-data" with { type: "json" };
import type { BrowserName, CompatStatement, Identifier, SimpleSupportStatement } from "@mdn/browser-compat-data/types";
import type { Diagnostic } from "#biome/report.ts";
import { browserTargets } from "./browserTargets.ts";

const BROWSERS: Readonly<Record<string, BrowserName>> = {
	"and_chr": "chrome_android",
	"and_ff": "firefox_android",
	chrome: "chrome",
	edge: "edge",
	firefox: "firefox",
	ie: "ie",
	"ios_saf": "safari_ios",
	"op_mob": "opera_android",
	opera: "opera",
	safari: "safari",
	samsung: "samsunginternet_android",
};

function version(value: string): number {
	return Number.parseFloat(value.replace(/^≤/u, "").split("-")[0] ?? value);
}

function supports(statement: SimpleSupportStatement, target: string): boolean {
	return (
		typeof statement.version_added === "string"
		&& version(target) >= version(statement.version_added)
		&& !(typeof statement.version_removed === "string" && version(target) >= version(statement.version_removed))
		&& !statement.flags
		&& !statement.prefix
		&& !statement.alternative_name
		&& !statement.partial_implementation
	);
}

function cssFunction(name: string, entries: Identifier | undefined): Identifier | undefined {
	if (entries === undefined) {
		return undefined;
	}
	const direct = entries[name];
	if (direct?.__compat?.description?.includes(`${name}()`)) {
		return direct;
	}
	for (const key of Object.keys(entries)) {
		if (key !== "__compat") {
			const found = cssFunction(name, entries[key]);
			if (found !== undefined) {
				return found;
			}
		}
	}
	return undefined;
}

function feature(message: string): CompatStatement | undefined {
	const match = /^CSS (?<kind>pseudo-element|pseudo-class|property value|property|at-rule|function|media condition) (?<name>.+) isn't part/u.exec(
		message,
	);
	if (match === null) {
		return undefined;
	}
	const kind = match.groups?.kind;
	const name = (match.groups?.name ?? "").toLowerCase();
	let entry: Identifier | undefined;
	if (kind === "pseudo-element" || kind === "pseudo-class") {
		entry = bcd.css.selectors?.[name];
	} else if (kind === "property value") {
		const [property = "", value = ""] = name.split(": ");
		entry = bcd.css.properties?.[property]?.[value];
	} else if (kind === "property") {
		entry = bcd.css.properties?.[name];
	} else if (kind === "at-rule") {
		entry = bcd.css["at-rules"]?.[name.replace(/^@/u, "")];
	} else if (kind === "function") {
		entry = cssFunction(name.replace(/\(\)$/u, ""), bcd.css.types);
	} else if (kind === "media condition") {
		entry = bcd.css["at-rules"]?.media?.[name];
	}
	return entry?.__compat;
}

export function browserDiagnostic(diagnostic: Diagnostic, file: string): Diagnostic | undefined {
	const targets = browserTargets(file);
	const compat = feature(diagnostic.message);
	if (targets === undefined) {
		return diagnostic;
	}
	const supported =
		targets.length > 0
		&& compat !== undefined
		&& targets.every((target) => {
			const [name = "", release = ""] = target.split(" ");
			const browser = BROWSERS[name];
			const support = browser === undefined ? undefined : compat.support[browser];
			return (Array.isArray(support) ? support : [support]).some((statement) => statement !== undefined && supports(statement, release));
		});
	return supported
		? undefined
		: { ...diagnostic, message: diagnostic.message.replace("the chosen Baseline", `the declared browser targets (${targets.join(", ")})`) };
}
