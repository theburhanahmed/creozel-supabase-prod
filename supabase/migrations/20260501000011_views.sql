-- Migration: Analytics Views

-- ─── analytics_overview ──────────────────────────────────────────────────────
-- Aggregated stats per team for the dashboard overview.
-- Accessed via PostgREST: GET /rest/v1/analytics_overview?team_id=eq.<id>
create or replace view public.analytics_overview as
select
  t.id as team_id,
  t.name as team_name,
  -- Post stats
  count(distinct sp.id)                                                    as total_posts,
  count(distinct sp.id) filter (where sp.status = 'published')            as published_posts,
  count(distinct sp.id) filter (where sp.status = 'scheduled')            as scheduled_posts,
  count(distinct sp.id) filter (where sp.status = 'draft')                as draft_posts,
  count(distinct sp.id) filter (where sp.status = 'failed')               as failed_posts,
  -- Credits
  coalesce(sum(cj.credits_used), 0)                                       as total_credits_used,
  count(distinct cj.id)                                                    as total_jobs,
  count(distinct cj.id) filter (where cj.status = 'completed')            as completed_jobs,
  -- Pipelines
  count(distinct pe.id) filter (
    where pe.status not in ('completed', 'failed')
  )                                                                        as active_pipelines,
  count(distinct pe.id)                                                    as total_pipeline_runs,
  case
    when count(distinct pe.id) = 0 then 0::numeric
    else round(
      count(distinct pe.id) filter (where pe.status = 'completed')::numeric /
      count(distinct pe.id)::numeric * 100,
      2
    )
  end                                                                      as pipeline_success_rate,
  -- Social
  count(distinct sc.id) filter (where sc.is_active = true)                as connected_accounts
from public.teams t
left join public.scheduled_posts    sp on sp.team_id = t.id
left join public.content_jobs       cj on cj.team_id = t.id
left join public.pipeline_executions pe on pe.team_id = t.id
left join public.social_connections sc on sc.team_id = t.id
group by t.id, t.name;

comment on view public.analytics_overview is
  'Aggregated dashboard stats per team. Used by the Dashboard and Analytics pages.';
