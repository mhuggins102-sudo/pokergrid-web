-- Fixed 100-point score bands for the daily leaderboard histogram.
--
-- Replaces the equal-split-of-range behavior of `daily_histogram`
-- (range/15 bins, empty bins omitted) with bands anchored at multiples
-- of 100 (0-99, 100-199, ...). Every band from the lowest occupied to
-- the highest occupied is returned — interior zero-count bands
-- included — so the client can render true gaps. Same JSON shape the
-- client already parses: { bins: [{lo, hi, count}], median, min, max,
-- total }.
--
-- `security definer` (+ pinned search_path) is REQUIRED, matching the
-- other daily_* RPCs: daily_plays has row-level security that blocks
-- anonymous reads, so a plain function runs as the caller and sees
-- zero rows. Table confirmed as public.daily_plays(date, score).
--
-- Run this whole file in the Supabase SQL editor; the old
-- daily_histogram function can stay (harmless) or be dropped.

create or replace function public.daily_histogram_bands(p_date date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with scores as (
    select score
    from public.daily_plays
    where date = p_date
  ),
  agg as (
    select
      count(*)::int as total,
      min(score)::int as min_score,
      max(score)::int as max_score,
      percentile_cont(0.5) within group (order by score) as median
    from scores
  ),
  bands as (
    -- floor() keeps negative scores sane (a -40 lands in the -100..-1 band).
    select gs.band
    from agg,
      generate_series(
        floor(agg.min_score / 100.0)::int,
        floor(agg.max_score / 100.0)::int
      ) as gs(band)
    where agg.total > 0
  ),
  counts as (
    select
      b.band,
      (
        select count(*)::int
        from scores s
        where floor(s.score / 100.0)::int = b.band
      ) as n
    from bands b
  )
  select jsonb_build_object(
    'bins',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'lo', band * 100,
            'hi', band * 100 + 99,
            'count', n
          )
          order by band
        )
        from counts
      ),
      '[]'::jsonb
    ),
    'median', (select round(median)::int from agg),
    'min', (select min_score from agg),
    'max', (select max_score from agg),
    'total', (select coalesce(total, 0) from agg)
  );
$$;

grant execute on function public.daily_histogram_bands(date)
  to anon, authenticated;
