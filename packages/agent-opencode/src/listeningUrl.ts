const LISTENING = /listening on (?<url>https?:\/\/\S+)/u;
export function listeningUrl(line: string): string | undefined {
	return LISTENING.exec(line)?.groups?.url;
}
