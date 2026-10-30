import type { Workspace, WorkspacePackage } from "#model.ts";
import type { Changeset } from "#parser.ts";

export function previousPackage(before: Workspace, declarations: readonly Changeset[], pkg: WorkspacePackage) {
	return (
		before.packages.find((old) => old.manifest.name === pkg.manifest.name)
		?? before.packages.find((old) => old.directory === pkg.directory)
		?? before.packages.find((old) => {
			const rename = new RegExp(`\\bRename \`${RegExp.escape(old.manifest.name)}\` to \`${RegExp.escape(pkg.manifest.name)}\``, "u");
			return declarations.some(
				(changeset) =>
					Object.hasOwn(changeset.packages, pkg.manifest.name)
					&& changeset.entries.some((entry) => entry.section === "Breaking" && rename.test(entry.text)),
			);
		})
	);
}
