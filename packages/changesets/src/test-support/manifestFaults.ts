import type { ReleaseManifest, Source } from "#model.ts";
import { CORE, changeset } from "./fixture.ts";

interface ManifestFault {
	readonly damage: (manifest: ReleaseManifest) => ReleaseManifest;
	readonly message: string;
	readonly name: string;
}

function firstSource(manifest: ReleaseManifest): Source {
	const source = manifest.plan.changesets[0];
	if (source === undefined) {
		throw new Error("The release fixture needs a changeset.");
	}
	return source;
}

export const manifestFaults: readonly ManifestFault[] = [
	{
		damage: (manifest) => ({ ...manifest, plan: { ...manifest.plan, changesets: [firstSource(manifest), firstSource(manifest)] } }),
		message: "unique .md filenames",
		name: "duplicate input",
	},
	{
		damage: (manifest) => ({ ...manifest, plan: { ...manifest.plan, changesets: [{ ...firstSource(manifest), name: "../feature.md" }] } }),
		message: "unique .md filenames",
		name: "unsafe input name",
	},
	{
		damage: (manifest) => ({
			...manifest,
			plan: { ...manifest.plan, changesets: [{ ...firstSource(manifest), text: changeset({ [CORE]: "patch" }) }] },
		}),
		message: "release inputs changed",
		name: "edited input",
	},
	{
		damage: (manifest) => ({ ...manifest, plan: { ...manifest.plan, changesets: [] } }),
		message: "keep pending changesets unchanged",
		name: "missing input",
	},
	{
		damage: (manifest) => ({
			...manifest,
			plan: { ...manifest.plan, releases: manifest.plan.releases.filter((release) => release.name !== "@test/peer") },
		}),
		message: "does not match the changeset plan",
		name: "missing dependent",
	},
	{
		damage: (manifest) => ({
			...manifest,
			plan: { ...manifest.plan, releases: manifest.plan.releases.map((release) => ({ ...release, to: "9.0.0" })) },
		}),
		message: "does not match the changeset plan",
		name: "wrong version",
	},
];
