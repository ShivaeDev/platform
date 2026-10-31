import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function reduceLongFile(root: string): void {
	writeFileSync(join(root, "src/long.ts"), "String(0);\n");
}

export function reduceLongerFile(root: string): void {
	writeFileSync(join(root, "src/longer.ts"), "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\n");
}

export function exceedLongerBaseline(root: string): void {
	writeFileSync(join(root, "src/longer.ts"), "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\nString(5);\nString(6);\n");
}
