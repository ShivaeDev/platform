export function sourceBin(cli: string) {
	return `#!/usr/bin/env node
import("node:child_process").then(({ spawnSync }) => {
  const result = spawnSync(process.execPath, ["--conditions=source", ${JSON.stringify(cli)}, ...process.argv.slice(2)], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
});
`;
}
