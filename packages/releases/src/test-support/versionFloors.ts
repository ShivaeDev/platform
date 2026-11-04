import { configured } from "./traits.ts";

export function versionFloors(values: Readonly<Record<string, string>>) {
	return configured(`sets version floors to ${JSON.stringify(values)}`, `export default { versionFloors: ${JSON.stringify(values)} };\n`);
}
