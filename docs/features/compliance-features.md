# Compliance & Safety Guards

Checks added to close the Gas Safe / F-Gas and double-booking gaps listed in `LOOPHOLES.md`. They are enforced in the backend; the frontend mirrors the main ones so users get a message before the request is sent.

## Technician certifications

- Technician profile now stores licence numbers **and expiry dates**: `gasSafeLicense` + `gasSafeExpiry`, `fGasLicense` + `fGasExpiry` (Settings, Edit Field Technician).
- A job's `requiredSkills` can include `GAS_SAFE` and `F_GAS`. The backend also adds them automatically from the equipment on the job: combi/system boilers need `GAS_SAFE`; heat pumps, air conditioning and chillers need `F_GAS`.
- Assigning a technician (create job or edit job) fails with `403` "Technician not qualified for this job" if they lack a required skill, lack the licence number, or the licence has expired. The message lists what is missing.
- Dispatch board assignment shows an amber "Certification Requirement Gap" banner and blocks the save.

## Scheduling conflicts

- A technician cannot hold two overlapping jobs on the same day, and a **30 minute travel buffer** is required between jobs. Violations return `409 SCHEDULE_CONFLICT`; the dispatch modal explains whether it is an overlap or a buffer clash and suggests moving the start back 30 minutes.
- Re-activating a held or cancelled job re-runs the check.
- A database exclusion constraint is the final backstop for overlaps.

## Job completion gate

`POST /jobs/:id/status` to `completed` returns `422 NOT_COMPLETABLE` listing what is missing, unless an admin overrides with a reason:

- unchecked `gas_safety` / `electrical` checklist items,
- a `refrigerant` checklist item but no refrigerant log entry,
- work performed text,
- customer signature.

Completed and cancelled jobs are read-only (`JOB_CLOSED`) except for admin; every override or edit is audited.

## Refrigerant log

`POST /jobs/:id/refrigerant` records one handling entry per charge, recovery, reclaim or leak check: refrigerant type, action, amount in kg, cylinder id, certificate number, optional equipment and notes. Technicians can only log on their own open jobs. Entries come back on the job as `refrigerantLogs`.

## Other guards

- Technicians can only remove parts they added to their own open, un-invoiced jobs (`DELETE /jobs/:id/parts/:usedId`); stock is returned.
- Technicians can only see their own technician profile (colleagues' phone, email and licence numbers are hidden).
- Technicians cannot adjust stock directly or add service records to jobs that are not theirs.
- Company bank details are only returned to admin and accountant.
- Status changes are limited per role; admins can tick "Force status (skip workflow rules)" in the dispatch modal, which requires a reason.
