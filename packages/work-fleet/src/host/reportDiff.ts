import { Effect, FileSystem, Schema } from "effect";
import { readCommand } from "#host/readCommand.ts";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { FleetFailure } from "#policy.ts";
import { RepositoryPath } from "#preparation/schema.ts";
import { REPORT_LIMITS, reportLimit } from "#reportLimits.ts";

export interface ReportFile {
	readonly bytes: Uint8Array;
	readonly path: string;
}

export const reportDiffFiles = Effect.fn("Fleet.reportDiffFiles")(
	function* (diff: string) {
		if (Buffer.byteLength(diff, "utf8") > REPORT_LIMITS.diffBytes) {
			return yield* Effect.fail(reportLimit("diffBytes"));
		}
		if (!diff.trim()) {
			return [];
		}
		const sections = diff.split(/(?=^diff --git )/mu).filter((section) => section.trim());
		if (sections.length > REPORT_LIMITS.attachmentCount) {
			return yield* Effect.fail(reportLimit("attachmentCount"));
		}
		if (
			sections.some((section) => {
				const modes = section.match(/^(?:(?:new file mode|deleted file mode|old mode|new mode) .*|index \S+ \d+)$/gmu) ?? [];
				return !(section.startsWith("diff --git ") && modes.length === 1 && /^new file mode 100(?:644|755)$/u.test(modes[0] ?? ""));
			})
		) {
			return yield* Effect.fail(new FleetFailure({ message: "Report attachments must be newly created regular files", reason: "invalid" }));
		}
		const fs = yield* FileSystem.FileSystem;
		const folder = yield* fs.makeTempDirectoryScoped();
		const stats = yield* readCommand("git", ["apply", "--numstat", "-z", "-"], folder, diff);
		const names = stats
			.split("\0")
			.filter(Boolean)
			.map((line) => line.split("\t").slice(2).join("\t"));
		if (names.length !== sections.length || names.some((name) => !Schema.is(RepositoryPath)(name) || name.split("/").includes(".git"))) {
			return yield* Effect.fail(new FleetFailure({ message: "Cloud report diff contains unsafe attachment paths", reason: "invalid" }));
		}
		yield* readCommand("git", ["apply", "--binary", "-"], folder, diff);
		return yield* reportAttachmentFiles(folder, names.sort());
	},
	Effect.mapError((error) =>
		error instanceof FleetFailure
			? error
			: new FleetFailure({ message: "Cloud report diff could not be downloaded as new regular files", reason: "integration" }),
	),
);
