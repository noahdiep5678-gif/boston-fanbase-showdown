# Stadium Pulse Boston project handoff

Updated November 24, 2026. Start with [AGENTS.md](AGENTS.md) for repository and Expo instructions. This file records product decisions, backend state reported from the dashboard, and the next work to pick up. Verify dashboard details before changing production.

## Product decisions

- **Stadium Pulse** with **Boston** beneath it is the current launch title. Boston Fanbase Showdown is the previous product name and still appears in the GitHub repository name. The older Red vs Blue rivalry and permanent team assignment are archived.
- The MVP sports are Celtics, Patriots, and Bruins. The Red Sox sit out the current MVP because they are out of season. Preserve historical content and data for a future return.
- The swipe order is Celtics, Patriots, Bruins, then General Boston Trivia. Team selection opens challenges and users can play across teams. Keep the minimalist layout and the green, blue, and yellow team colors through the games. The user approved the 56-unit vertical gap between game choices.
- The opening uses a muted Bruins → Celtics → Patriots montage. The first two clips are each 1.5 seconds around the scoring moment. The full Patriots clip is about 4.47 seconds. The clips share the same centered frame and black surround. The title fades in, holds still for one second, then shakes with increasing intensity for a full second before shattering into the Celtics carousel. Reduced Motion skips the shake and shatter.
- The team menu offers Wicked Smaht Daily Trivia and Game Predictions. General Boston offers a short practice quiz and Where in Boston. Wicked Smaht should emphasize curated, diverse daily questions with Boston sports and culture, satisfying answer discovery, and easy result sharing. DailyTens inspired the clean presentation. The app has its own design and content.
- Sports Predictions shows the **next game's picks and the latest completed game's results**. Keep older outcomes in storage for future rankings. Prefer matchup-specific totals, team scores, margins, and eventually player stats over simply asking who will win. MVP predictions involve no wagering or cash prizes.
- The rankings design calls for the top five fans per active team and overall Boston Superfans across eligible scored challenges. Current screens have empty standings. An authoritative scoring ledger, team comparison formula, weekly boundaries, tie rules, and profile/identity recovery remain open. Practice scores should stay out of standings.
- Longer-term winner privileges discussed for the sports fan-base format include the winning fan base voting on the next week's challenge category and each sport's top fan proposing a question subject to editorial review and creator credit. Voting eligibility and the exact mechanics still need decisions.

## Current implementation and verification

| Area | Current state |
| --- | --- |
| Intro, carousel, menus | The working branch includes the approved redesign, three team logos, and the bundled MP4. The founder viewed and approved the edited montage on their phone. The new Stadium Pulse title and shatter passed lint, TypeScript, and iOS JavaScript bundling. Verify the animation on device. |
| Celtics predictions | The app uses the existing Supabase backend for schedule, anonymous fan identity, saved picks, and latest completed results. The founder's November 24 picks still need end-to-end verification. |
| Patriots and Bruins | Fictional practice picks work in the app. The new `team-prediction-schedule` Edge Function and client card are in the branch. The function passed mocked league mapping, filtering, pagination, empty state, and error checks. Deployment and provider access remain unverified. The function only reads upcoming schedules. Real questions, saved picks, and settlement for these teams remain to be built. |
| Rankings | UI only. The app has no shared source for live standings or aggregate scores. |

## Where to resume

1. **Verify the Celtics picks first.** The founder submitted three picks on November 24. The exact game ID and answers are unknown here. Identify them through authorized read-only access or the founder's existing iPhone session. The older Warriors game was a separate test.
2. Compare the matchup, final stored score, frozen threshold for each question, all three saved selections, individual grades, and the correct-count display on the iPhone. Preserve the existing anonymous session. Reinstalling or clearing local data can lose access to that guest identity.
3. If the result is stale, check the Celtics worker response and game row before changing grading. Check the deployed schema, RLS, functions, and scheduled job against what is known below.
4. Choose a source for matchup-specific lines with the founder. Editorial values, a statistical model, and a licensed provider are open options. Current Celtics defaults are sample lines. Freeze question wording and thresholds before fans answer. Preserve existing picks and their original lines through schedule refresh and rescheduling.
5. Continue Patriots and Bruins rollout. Verify access to both NFL and NHL schedule feeds, deploy the new function with authorized access, and smoke-test both cards. Then implement real per-game questions, authenticated saves, server-side deadlines, final-score ingestion, and grading. Keep provider plus league in game identity so IDs cannot collide across sports.

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
