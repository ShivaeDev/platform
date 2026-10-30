import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { qualityKit } from "./kit.ts";

export const PNPM_LOCKFILE = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:
  .:
    dependencies:
      '@tanstack/react-router':
        specifier: 'catalog:'
        version: 1.170.46
`;

export const pnpmLockfile = qualityKit.trait("repository", "pnpm writes its lockfile", (root) => {
	writeFileSync(join(root, "pnpm-lock.yaml"), PNPM_LOCKFILE);
});

export const misformattedYaml = qualityKit.trait("repository", "an author leaves workspace YAML unformatted", (root) => {
	writeFileSync(join(root, "pnpm-workspace.yaml"), "catalog:\n    vite: 8.3.5\n");
});
