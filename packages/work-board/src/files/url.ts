export function fileUrl(file: string): string {
	return `/${file.split("/").map(encodeURIComponent).join("/")}`;
}
