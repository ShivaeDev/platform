import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Config, Effect } from "effect";
import { failedFiles, readAttempt } from "./freshReports.ts";

mkdirSync(".ci", { recursive: true });
for (const path of [
	"tests.json",
	"tests.junit.xml",
	"tests.first.json",
	"tests.first.junit.xml",
	"tests.first.bin",
	"tests.rerun.json",
	"tests.rerun.junit.xml",
]) {
	rmSync(`.ci/${path}`, { force: true });
}
const worker = fileURLToPath(new URL("./testAttempt.ts", import.meta.url));
function run(attempt: string) {
	return spawnSync(process.execPath, ["--conditions=source", worker, attempt, ...process.argv.slice(2)], { stdio: "inherit" });
}
const event = Effect.runSync(Config.string("GITHUB_EVENT_NAME").pipe(Config.withDefault("")));
const first = run("first");
process.exitCode = first.status ?? 1;
if (
	first.status !== 0
	&& first.signal === null
	&& event === "merge_group"
	&& existsSync(".ci/tests.json")
	&& existsSync(".ci/tests.first.bin")
	&& readAttempt(".ci/tests.first.bin").errors.length === 0
	&& failedFiles(JSON.parse(readFileSync(".ci/tests.json", "utf8"))).length > 0
) {
	copyFileSync(".ci/tests.json", ".ci/tests.first.json");
	copyFileSync(".ci/tests.junit.xml", ".ci/tests.first.junit.xml");
	const rerun = run("rerun");
	process.exitCode = rerun.status ?? 1;
}
