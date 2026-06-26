# Evidence Import

Graphletter supports a narrow bulk import for evidence inventory rows. This flow creates evidence records only; it does not upload or attach binary files.

## Formats

Upload a `.csv` or `.json` file from the Evidence page.

CSV headers are normalized to lowercase snake case, so `SCF Control ID` and `scf_control_id` are equivalent. JSON files must be an array of row objects.

## Columns

Required:

- `file_name` - evidence artifact name shown in the evidence table.
- `scf_control_id` - SCF control ID that must exist in Graphletter.
- `evidence_type` - one of `document`, `screenshot`, `policy`, `procedure`, `log`, `certificate`, `configuration`, `other`, `aws`, `azure`, `gcp`, `github`, `okta`, `supabase`.

Optional:

- `erl_id` - SCF evidence request UUID or ERL global ID.
- `erl_global_id` - ERL global ID, used when `erl_id` is omitted.
- `documentation_artifact` - display artifact name. If an ERL record is matched, its artifact name is used by default.
- `description` - free-form notes, up to 2000 characters.
- `submitted_at` - ISO-8601 date or timestamp. Omitted values use the import commit time.

Ownership fields such as `user_id` and `submitted_by` are rejected. The server always derives evidence ownership from the signed-in user.

## Preview And Commit

The import dialog first sends the file to `/api/evidence/import` with `mode: "preview"`. Preview parses every row and returns row numbers, normalized values, and actionable validation errors.

Commit sends the same content with `mode: "commit"`. If any row is invalid, the API returns `422` and creates no evidence records. When all rows are valid, the API inserts the evidence rows in one bulk database statement with `evidence_status: "submitted"` and `file_type: "external/import"`.

## Example CSV

```csv
file_name,scf_control_id,evidence_type,erl_global_id,documentation_artifact,description,submitted_at
incident-response-playbook.pdf,IRO-05,document,ERL-IRO-001,Incident Response Program Documentation,Current response plan,2026-06-26
access-control-policy.pdf,AC-01,policy,,Access Control Policy,Annual policy refresh,
```

## Example JSON

```json
[
  {
    "file_name": "incident-response-playbook.pdf",
    "scf_control_id": "IRO-05",
    "evidence_type": "document",
    "erl_global_id": "ERL-IRO-001",
    "description": "Current response plan"
  }
]
```
