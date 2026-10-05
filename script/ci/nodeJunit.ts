import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

export function nodeJunit(xml: string): string {
	if (!(xml.includes("<testsuites>") && xml.includes("</testsuites>"))) {
		throw new Error("Expected the Node test runner's JUnit testsuites document");
	}
	return xml.replace("<testsuites>", '<testsuites><testsuite name="ci-orchestration">').replace("</testsuites>", "</testsuite></testsuites>");
}

const path = process.argv[2];
if (path !== undefined && existsSync(path)) {
	writeFileSync(path, nodeJunit(readFileSync(path, "utf8")));
}
