import { Effect } from "effect";
import { REPORTS, readFile, type Suite } from "./suite.ts";

export interface Testcase {
	readonly classname: string;
	readonly failed: boolean;
	readonly file: string | undefined;
	readonly name: string;
}

const TESTCASE = /<testcase (?<attributes>[^>]*?)(?<selfClosing>\/?)>(?<body>[\s\S]*?)(?:<\/testcase>|(?=<testcase )|(?=<\/testsuite>))/gu;
const ATTRIBUTE = /(?<key>\w+)="(?<value>[^"]*)"/gu;
const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&apos;": "'", "&gt;": ">", "&lt;": "<", "&quot;": '"' };

function unescapeXml(value: string): string {
	return value.replace(/&(?:amp|apos|gt|lt|quot);/gu, (entity) => ENTITIES[entity] ?? entity);
}

export function testcases(xml: string): readonly Testcase[] {
	return [...xml.matchAll(TESTCASE)].map((match) => {
		const attributes = Object.fromEntries(
			[...(match.groups?.attributes ?? "").matchAll(ATTRIBUTE)].map((attribute) => [
				attribute.groups?.key,
				unescapeXml(attribute.groups?.value ?? ""),
			]),
		);
		return {
			classname: attributes.classname ?? "",
			failed: match.groups?.selfClosing === "" && /<failure/u.test(match.groups?.body ?? ""),
			file: attributes.file,
			name: attributes.name ?? "",
		};
	});
}

export function reportVerbs(suite: Suite) {
	function read(name: string) {
		return readFile(suite, `${REPORTS}/${name}`);
	}
	return {
		file: read,
		flakyTests: () =>
			Effect.sync(() => {
				const contents = read("flaky-tests.json");
				return contents === undefined ? undefined : JSON.parse(contents);
			}),
		json: () => Effect.sync(() => JSON.parse(read("tests.json") ?? "{}")),
		summary: () => readFile(suite, "summary.md") ?? "",
		testcases: () => Effect.sync(() => testcases(read("tests.junit.xml") ?? "")),
	};
}
