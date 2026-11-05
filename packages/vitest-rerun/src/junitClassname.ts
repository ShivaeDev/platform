export function junitClassname(file: string, project: string): string {
	return project === "" ? file : `|${project}| ${file}`;
}
