import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "../..");
const compiler = join(root, "node_modules/typescript/bin/tsc");

export async function declarationFiles() {
	const directory = await mkdtemp(join(tmpdir(), "jobs-declarations-"));
	try {
		await execute(process.execPath, [
			compiler,
			"--project",
			join(root, "tsconfig.build.json"),
			"--emitDeclarationOnly",
			"--outDir",
			join(directory, "dist"),
		]);
		const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
		const entries = (await readdir(join(directory, "dist"), { recursive: true })).filter((file) => file.endsWith(".d.ts"));
		await writeFile(
			join(directory, "package.json"),
			JSON.stringify({
				exports: { "./*.ts": { types: "./dist/*.d.ts" } },
				imports: { "#*.ts": "./dist/*.d.ts" },
				name: manifest.name,
				type: "module",
			}),
		);
		await symlink(join(root, "node_modules"), join(directory, "node_modules"));
		await writeFile(
			join(directory, "consumer.ts"),
			entries
				.map(
					(file, index) =>
						`import type * as Entry${index} from "@shivaedev/jobs/${file.replace(/\.d\.ts$/u, ".ts")}";\nexport type Export${index} = typeof Entry${index};`,
				)
				.join("\n"),
		);
		await writeFile(
			join(directory, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { noEmit: true, skipLibCheck: false },
				extends: join(root, "tsconfig.json"),
				include: ["consumer.ts"],
			}),
		);
		const { stdout } = await execute(process.execPath, [compiler, "--project", join(directory, "tsconfig.json"), "--listFiles"], {
			maxBuffer: 4 * 1024 * 1024,
		});
		return stdout.split("\n").filter((file) => file.includes("/pg-boss/") || /\/pg-boss@/u.test(file));
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
}
