# Latest PR review-resolution workflow

Status: Draft — grilling in progress.

## Goal

Find the repository's applicable latest pull request, triage every review
comment, implement and verify valid fixes, respond to each thread, and continue
until the pull request is merge-ready with no pending actionable comments.

## Candidate trigger

Run on explicit request. A future event-triggered version may run whenever a
new review or review comment is submitted.

## Candidate PR selection

Select the most recently updated open pull request in
`Vishnuraj910/kodekommunity` targeting `main`.

If no matching pull request exists, stop with a brief stating that no eligible
PR was found. Never substitute a closed PR, draft from another repository, or
PR targeting a different base.

## Known outcome requirements

- Inspect every unresolved review conversation and submitted review.
- Classify each comment as actionable, already addressed, obsolete, duplicate,
  incorrect, or requiring a user decision.
- Implement actionable changes on the PR branch.
- Run checks proportional to each change and the repository's required gates.
- Reply with concise evidence before resolving a thread.
- Re-fetch reviews and checks after every push.
- Continue until no actionable unresolved comments remain.
- Do not claim merge readiness while required checks, approvals, conflicts, or
  unresolved conversations remain.

## Unresolved decisions

- Which comment classes may be handled autonomously.
- Which changes require a human checkpoint.
- Whether to resolve incorrect or obsolete reviewer comments after replying.
- Required CI, approval, and mergeability gates.
- Polling cadence and termination behavior when new comments arrive.
- Shape and destination of the final brief.
