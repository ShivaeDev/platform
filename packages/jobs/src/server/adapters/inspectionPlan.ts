import { quotedSchema } from "#server/internal/storedRows.ts";

export function inspectionChannel(schema: string): string {
	return `jobs:${schema}`;
}

export function inspectionPlan(schema: string): string {
	const quoted = quotedSchema(schema);
	const channel = inspectionChannel(schema).replaceAll("'", "''");
	const body = `BEGIN
	CREATE OR REPLACE FUNCTION ${quoted}.effect_job_changed() RETURNS trigger LANGUAGE plpgsql AS $body$
	BEGIN
		PERFORM pg_notify('${channel}', COALESCE(NEW.name, OLD.name));
		RETURN NULL;
	END
	$body$;
	CREATE OR REPLACE TRIGGER effect_job_changed AFTER INSERT OR UPDATE OR DELETE ON ${quoted}.job
	FOR EACH ROW EXECUTE FUNCTION ${quoted}.effect_job_changed();
	END`;
	return `DO '${body.replaceAll("'", "''")}'`;
}
