# Stadium Pulse Boston project handoff

Updated November 24, 2026. Start with [AGENTS.md](AGENTS.md) for repository and Expo instructions. This file records product decisions, backend state reported from the dashboard, and the next work to pick up. Verify dashboard details before changing production.

## Product decisions

- **Stadium Pulse** with **Boston** beneath it is the current launch title. Boston Fanbase Showdown is the previous product name and still appears in the GitHub repository name. The older Red vs Blue rivalry and permanent team assignment are archived.
- The MVP sports are Celtics, Patriots, and Bruins. The Red Sox sit out the current MVP because they are out of season. Preserve historical content and data for a future return.
- The swipe order is Celtics, Patriots, Bruins, then General Boston Trivia. Team selection opens challenges and users can play across teams. Keep the minimalist layout and the green, blue, and yellow team colors through the games. The user approved the 56-unit vertical gap between game choices.
- The opening uses a muted Bruins → Celtics → Patriots montage. The first two clips are each 1.5 seconds around the scoring moment. The full Patriots clip is about 4.47 seconds. The clips share the same centered frame and black surround. The title fades in, holds still for 1.5 seconds, then shakes with increasing intensity for a full second before shattering into the Celtics carousel. Reduced Motion skips the shake and shatter.
- The team menu offers Wicked Smaht Daily Trivia and Game Predictions. General Boston offers a short practice quiz and Where in Boston. Wicked Smaht should emphasize curated, diverse daily questions with Boston sports and culture, satisfying answer discovery, and easy result sharing. DailyTens inspired the clean presentation. The app has its own design and content.
- Sports Predictions shows the **next game's picks and the latest completed game's results**. Keep older outcomes in storage for future rankings. Prefer matchup-specific totals, team scores, margins, and eventually player stats over simply asking who will win. MVP predictions involve no wagering or cash prizes.
- The rankings design calls for the top five fans per active team and overall Boston Superfans across eligible scored challenges. Current screens have empty standings. An authoritative scoring ledger, team comparison formula, weekly boundaries, tie rules, and profile/identity recovery remain open. Practice scores should stay out of standings.
- Longer-term winner privileges discussed for the sports fan-base format include the winning fan base voting on the next week's challenge category and each sport's top fan proposing a question subject to editorial review and creator credit. Voting eligibility and the exact mechanics still need decisions.

## Current implementation and verification

| Area | Current state |
| --- | --- |
| Intro, carousel, menus | The working branch includes the approved redesign, three team logos, and the bundled MP4. The founder viewed and approved the edited montage on their phone. The new Stadium Pulse title and shatter passed lint, TypeScript, and iOS JavaScript bundling. Verify the animation on device. |
| Celtics predictions | The app uses the existing Supabase backend for schedule, anonymous fan identity, saved picks, and latest completed results. The founder's November 24 picks still need end-to-end verification. |
| Patriots and Bruins | Fictional practice picks remain available before rollout. The app and shared worker now support real questions, saved picks, and final-score grading. The shared pipeline passed local tests with mocked feeds. Deployment and live provider access remain unverified. |
| Rankings | UI only. The app has no shared source for live standings or aggregate scores. |

## Where to resume

1. **Verify the Celtics picks first.** The founder submitted three picks on November 24. The exact game ID and answers are unknown here. Identify them through authorized read-only access or the founder's existing iPhone session. The older Warriors game was a separate test.
2. Compare the matchup, final stored score, frozen threshold for each question, all three saved selections, individual grades, and the correct-count display on the iPhone. Preserve the existing anonymous session. Reinstalling or clearing local data can lose access to that guest identity.
3. If the result is stale, check the Celtics worker response and game row before changing grading. The founder instructed us to proceed assuming the check passed. That assumption does not establish on-device verification.
4. Roll out the shared predictions pipeline below. It uses BALLDONTLIE game scores to calculate matchup-specific lines and leaves existing Celtics records in the original system.

## Shared predictions rollout

Hosted staging is active at $0/month in **Stadium Pulse Staging** (`vvfvvxgjmenelktveixr`). The migration and both prediction Edge Functions are deployed. A rolled-back staging test verified game publication, pick privacy, deadline enforcement, and grading against the original lines. Lint, TypeScript, and the local integration test passed after the NBA worker was narrowed to 60 days of history to fit the free provider limits.

The live worker published three Celtics games and one Patriots game. The staging Vault token is configured, and staging Cron runs Celtics at minutes 0, 15, 30, and 45 and Patriots at minutes 5, 20, 35, and 50. A scheduled Patriots run and a manual execution of the exact Celtics Cron command both returned HTTP 200 through `pg_net`. The staging jobs target the staging URL directly. Bruins automation is off because the current BALLDONTLIE NHL games endpoint requires a paid tier. Production was untouched.

When resuming, check a scheduled Celtics run in Cron and `net._http_response`, enable staging anonymous sign-in, and verify picks and results on iPhone using staging credentials while preserving the existing production guest session. Decide how to supply Bruins fixtures and scores without a paid feed. The existing legacy Celtics iPhone check is still pending.

The [migration](supabase/migrations/20261125000000_team_predictions.sql), [worker](supabase/functions/sync-team-predictions/index.ts), app integration, and [cron SQL](supabase/operations/schedule-team-predictions.sql) support the rollout below. Verify production access and live behavior before production rollout.

- Three questions per game cover the combined score, Boston's score, and Boston's margin. The model estimates each side's score by averaging its recent scoring and the opponent's recent scoring allowed. It uses up to five final games per side with a minimum of three. It converts each estimate to a half-unit threshold. Games with insufficient history wait for lines. These are app-calculated trivia thresholds.
- The worker syncs Boston fixtures from the current and prior league seasons. It publishes complete slates within seven days and reconciles results and status changes for up to 45 days. It keeps published lines immutable and never extends a previously published deadline. The database grades from final scores on read. Corrections within the sync window can update results without rewriting picks.
- Use a staging Supabase project to apply the migration and deploy `sync-team-predictions` with gateway JWT verification disabled for that function only. It authenticates each POST with the private `x-score-sync-token` header. Configure `TEAM_PREDICTIONS_SYNC_TOKEN` in Edge Function Secrets and the same value under `team_predictions_sync_token` in Vault. The cron SQL references `celtics_project_url` in Vault. Confirm it points to the intended project. The worker uses `BALLDONTLIE_API_KEY` plus Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Manually invoke each team with POST and `?team=patriots`, `?team=bruins`, or `?team=celtics`. Verify your BALLDONTLIE subscription supports all three games feeds and can handle the scheduled requests. In staging, verify a new game publishes, another user cannot see a saved pick, an expired pick is rejected, and final scores grade the original lines.
- Choose a future Celtics cutover timestamp with an explicit timezone and set `CELTICS_PREDICTIONS_CUTOVER_AT`. Coordinate it with the last legacy game and prior clients. The new system skips any Celtics game already registered in the legacy table. Keep the legacy score worker running until its outstanding games settle. The app still shows legacy Celtics results until the shared pipeline has a completed result. Confirm the first shared Celtics slate before retiring the legacy schedule endpoint.
- Install the staggered jobs with the cron SQL after a successful manual run. Check HTTP responses and function logs to confirm publication and settlement. Apply production changes with authorized dashboard or CLI access and verify the rollover on iPhone.

## Supabase context outside this repo

The existing Celtics SQL definitions, RLS policies, cron setup, and deployed Celtics Edge Function sources were maintained in the Supabase dashboard. The repo does not contain a full backend baseline. Capture the current live definitions before writing migrations. Earlier setup scripts and single-question endpoints may reflect older behavior.

| Deployed component, reported in prior work | Role |
| --- | --- |
| `test-celtics-schedule` | The app calls GET. Looks up Celtics games via BALLDONTLIE NBA, registers future games in Supabase, then returns schedule data. Duplicate registration preserves existing stored games and lines, so a provider reschedule may leave the original stored deadline in place. |
| `sync-celtics-worker` | Scheduled Edge Function. A shared token authenticates the scheduled call. Polls eligible registered games and writes validated final scores and full team names. Its endpoint slug differs from the cron job name. |
| `sync-celtics-scores` | Reported pg_cron job running every 15 minutes through pg_net. A successful cron row only shows that the request was queued. Inspect the corresponding HTTP status and response in `net._http_response` or the Edge Function logs. |
| `celtics-game-result` | Older single-question Edge Function. The multi-question app currently reads the result RPC instead. |
| `latest_completed_celtics_answers()` | Current results RPC. Returns the latest completed Celtics game and only the current fan's choices via `auth.uid()`, plus actuals and grading. Older result RPCs may still exist. |

The Celtics tables are `public.celtics_prediction_games`, `public.celtics_prediction_questions`, and `public.celtics_prediction_picks`. Reported pick identity is `(game_id, user_id, question_id)`. RLS limits reads and writes to the current fan. Database triggers create default questions on registration, enforce the pick deadline, and protect questions once picks exist or play begins.

The three question types are combined points, Celtics points, and Celtics margin. Margin is Boston score minus opposing score. The stored threshold is authoritative. Actual above the threshold is over, below is under, and equality is a push. The displayed denominator counts answered, graded over/under picks and excludes pushes or ungraded picks.

The client uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Anonymous sign-in supplies a persistent fan identity. The schedule functions use `BALLDONTLIE_API_KEY` server-side. The reported Celtics worker uses `CELTICS_SCORE_SYNC_TOKEN` and the `x-score-sync-token` header from its scheduled call. Share access through the team's approved credential channels. Keep service keys, provider keys, Vault values, and user data out of commits and logs.

Daily content and game displays use `America/New_York`. Store game start times as timezone-aware instants. When expanding automation, address postponements, cancellations, updates to a game already on screen, official score corrections, and retry-safe settlement.

## Working together

- Work in GitHub's `stadium-pulse-mvp` branch for this handoff. The founder tests on an iPhone with Expo Go from a Windows laptop. Use `npm ci` and `npx expo start --go --lan`, then scan the terminal QR on the same Wi-Fi. Run lint and TypeScript before handing changes back. An Expo export verifies bundling. Device behavior and live Supabase behavior require their own checks.
- Prefer small changes, plain-language explanations, and a clear distinction between app code, live backend state, and device observations. The founder makes product decisions such as the source of prediction lines and ranking rules.
- The three raw screen recordings and earlier detailed handoffs were kept in the original local workspace. The working cut is bundled in this branch.
