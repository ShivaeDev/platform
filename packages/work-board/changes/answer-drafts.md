### Fixed

- Response drafts use effect-form persistence and retain input across reloads and source revisions. Questionnaire recovery keeps one snapshot per prior context, so repeated remounts retain answers without growing the draft. Response and handoff drafts now expire after seven days with a 256 KiB limit per draft; Clear draft restores only the current form.
