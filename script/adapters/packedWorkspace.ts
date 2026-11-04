export function packedWorkspace(workspace: string): string {
	// A mature parent's dependency floor may have no mature release; packed checks still need to exercise our packages.
	return `minimumReleaseAge: 10080\nminimumReleaseAgeStrict: false\n${workspace.replace(/^minimumReleaseAge(?:Strict)?:.*\n?/gmu, "")}`;
}
