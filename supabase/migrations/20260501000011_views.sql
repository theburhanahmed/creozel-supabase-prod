-- Migration: Analytics Views

-- ─── analytics_overview ──────────────────────────────────────────────────────
-- Aggregated stats per team OR per solo user (team_id IS NULL).
-- Team rows: accessed via PostgREST with team_id=eq.<id>
-- Solo rows: accessed via PostgREST with team_id=is.null
create or replace view public.analytics_overview as
-- Team-scoped rows
select
  t.id   as team_id,
  t.name as team_name,
  count(distinct sp.id)                                                    as total_posts,
  count(distinct sp.id) filter (where sp.status = 'published')            as published_posts,
  count(distinct sp.id) filter (where sp.status = 'scheduled')            as scheduled_posts,
  count(distinct sp.id) filter (where sp.status = 'draft')                as draft_posts,
  count(distinct sp.id) filter (where sp.status = 'failed')               as failed_posts,
  coalesce(sum(cj.credits_used), 0)                                       as total_credits_used,
  count(distinct cj.id)                                                    as total_jobs,
  count(distinct cj.id) filter (where cj.status = 'completed')            as completed_jobs,
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
  count(distinct sc.id) filter (where sc.is_active = true)                as connected_accounts
from public.teams t
left join public.scheduled_posts     sp on sp.team_id = t.id
left join public.content_jobs        cj on cj.team_id = t.id
left join public.pipeline_executions pe on pe.team_id = t.id
left join public.social_connections  sc on sc.team_id = t.id
group by t.id, t.name

union all

-- Solo user rows (no team)
select
  null::uuid as team_id,
  'Personal'  as team_name,
  count(distinct sp.id)                                                    as total_posts,
  count(distinct sp.id) filter (where sp.status = 'published')            as published_posts,
  count(distinct sp.id) filter (where sp.status = 'scheduled')            as scheduled_posts,
  count(distinct sp.id) filter (where sp.status = 'draft')                as draft_posts,
  count(distinct sp.id) filter (where sp.status = 'failed')               as failed_posts,
  coalesce(sum(cj.credits_used), 0)                                       as total_credits_used,
  count(distinct cj.id)                                                    as total_jobs,
  count(distinct cj.id) filter (where cj.status = 'completed')            as completed_jobs,
  0::bigint                                                                as active_pipelines,
  0::bigint                                                                as total_pipeline_runs,
  0::numeric                                                               as pipeline_success_rate,
  count(distinct sc.id) filter (where sc.is_active = true)                as connected_accounts
from public.scheduled_posts sp
full outer join public.content_jobs       cj on cj.user_id = sp.user_id and cj.team_id is null
full outer join public.social_connections sc on sc.user_id = coalesce(sp.user_id, cj.user_id) and sc.team_id is null
where sp.team_id is null or cj.team_id is null or sc.team_id is null
group by 1, 2;

comment on view public.analytics_overview is
  'Aggregated dashboard stats per team (or personal scope when team_id IS NULL). Used by the Dashboard and Analytics pages.';
