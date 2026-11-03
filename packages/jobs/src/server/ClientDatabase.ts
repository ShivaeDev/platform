export interface ClientDatabase {
	beginTransaction?: () => Promise<{ db: ClientDatabase; commit: () => Promise<void>; rollback: () => Promise<void> }>;
	executeSql: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
	listen?: (channel: string, onNotification: (payload: string) => void, onReconnect: () => void) => Promise<{ close: () => Promise<void> }>;
	poolCounts?: () => { max: number; total: number; idle: number; waiting: number } | null;
	setSessionStatements?: (statements: string[]) => Promise<void>;
}
