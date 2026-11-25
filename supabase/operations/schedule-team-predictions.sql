-- Run after deploying sync-team-predictions and provisioning its Vault entries.
-- The offsets spread the API requests across each 15-minute window.
select cron.schedule(
  'sync-team-predictions-' || team,
  schedule,
  format($job$
    select net.http_post(
      url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'celtics_project_url'), '/')
        || '/functions/v1/sync-team-predictions?team=' || %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-score-sync-token', (select decrypted_secret from vault.decrypted_secrets where name = 'team_predictions_sync_token')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$, team)
)
from (values
  ('celtics', '0,15,30,45 * * * *'),
  ('patriots', '5,20,35,50 * * * *'),
  ('bruins', '10,25,40,55 * * * *')
) as jobs(team, schedule);
