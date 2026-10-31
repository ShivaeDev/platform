import { quotedSchema } from "#internal/storedRows.ts";

export function deadLetterResolutionPlan(schema: string): string {
	const quoted = quotedSchema(schema);
	const jobTable = `${quoted}.job`.replaceAll("'", "''");
	const body = `BEGIN
		PERFORM pg_advisory_xact_lock(hashtextextended('${jobTable}.effect_dead_letter_resolution', 0));
		CREATE OR REPLACE FUNCTION ${quoted}.effect_dead_letter_resolution() RETURNS trigger LANGUAGE plpgsql AS $resolve$
		BEGIN
			DELETE FROM ${quoted}.job
			WHERE name = NEW.name || '-dlq' AND source_name = NEW.name AND source_id = NEW.id
				AND source_created_on = NEW.created_on;
			RETURN NEW;
		END
		$resolve$;
		IF NOT EXISTS (
			SELECT 1 FROM pg_trigger WHERE tgrelid = '${jobTable}'::regclass AND tgname = 'effect_dead_letter_resolution'
		) THEN
			CREATE TRIGGER effect_dead_letter_resolution AFTER UPDATE OF state ON ${quoted}.job
			FOR EACH ROW WHEN (NEW.state = 'completed' AND OLD.state IS DISTINCT FROM NEW.state)
			EXECUTE FUNCTION ${quoted}.effect_dead_letter_resolution();
			DELETE FROM ${quoted}.job AS copy USING ${quoted}.job AS source
			WHERE source.state = 'completed' AND copy.name = source.name || '-dlq'
				AND copy.source_name = source.name AND copy.source_id = source.id AND copy.source_created_on = source.created_on;
		END IF;
	END`;
	return `DO '${body.replaceAll("'", "''")}'`;
}
