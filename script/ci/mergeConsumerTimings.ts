import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { mergeConsumerTimingReports } from "./timings.ts";

const { values } = parseArgs({
	options: { directory: { type: "string" }, output: { type: "string" }, "run-id": { type: "string" }, sha: { type: "string" } },
});
if (values.directory === undefined || values.output === undefined || values["run-id"] === undefined || values.sha === undefined) {
	throw new Error("Provide --directory, --output, --run-id and --sha");
}
const reports: unknown[] = globSync("**/consumers.json", { cwd: values.directory }).map((path) =>
	JSON.parse(readFileSync(join(values.directory ?? "", path), "utf8")),
);
writeFileSync(values.output, `${JSON.stringify(mergeConsumerTimingReports(reports, values["run-id"], values.sha), null, 2)}\n`);
