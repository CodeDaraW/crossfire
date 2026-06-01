# Review rubric

Normal review hunts for material defects: correctness bugs, regressions, missing
tests, security/permission boundaries, data loss, concurrency/races, error
handling, and compatibility/schema drift. Style-only feedback is out of scope.

Adversarial review is a design/risk challenge: assume the change is subtly wrong,
attack auth/permissions/data-loss/rollback/race/schema-drift/observability, and
prefer one decisive no-ship finding over many weak nits.

Both require grounded findings (cite file/line, lower confidence on truncated
context) and structured JSON output.
