-- Adaptive 8-band score distribution for the daily leaderboard.
--
-- Replaces the fixed 100-point bands: the histogram is now ALWAYS
-- exactly 8 buckets whose width adapts to the day's score spread. The
-- width is the smallest multiple of 50 (50, 100, 150, …) such that 8
-- buckets — anchored at the multiple of that width at-or-below the
-- minimum score — reach past the maximum score. Typical days land on
-- 50-point buckets (e.g. 200-249 … 550-599); widely spread days fall
-- back to 100 or, rarely, 150+. Trailing/interior zero-count buckets
-- are returned so the client can render true gaps.
--
-- Fewer than TWO scores returns an empty bins array — a one-entry
-- "distribution" is noise, and the client hides the section entirely.
--
-- Same JSON shape the client already parses:
--   { bins: [{lo, hi, count}], median, min, max, total }
--
-- `security definer` (+ pinned search_path) is REQUIRED, matching the
-- other daily_* RPCs: daily_plays has row-level security that blocks
-- anonymous reads, so a plain function runs as the caller and sees
-- zero rows. Table confirmed as public.daily_plays(date, score).
--
-- Run this whole file in the Supabase SQL editor (CREATE OR REPLACE —
-- it swaps in over the previous fixed-band version).

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
  -- Smallest 50-multiple width whose 8 min-anchored buckets cover the
  -- whole min..max span. floor() keeps negative scores sane (a -40
  -- anchors the first bucket at -50).
  chosen as (
    select
      w.width,
      floor(agg.min_score::numeric / w.width)::int * w.width as start
    from agg
    cross join lateral (
      select g.k * 50 as width
      from generate_series(1, 200) as g(k)
      where agg.total >= 2
        and floor(agg.min_score::numeric / (g.k * 50))::int * (g.k * 50)
              + 8 * (g.k * 50) > agg.max_score
      order by g.k
      limit 1
    ) as w
  ),
  counts as (
    select
      chosen.start + gs.i * chosen.width as lo,
      chosen.start + (gs.i + 1) * chosen.width - 1 as hi,
      (
        select count(*)::int
        from scores s
        where s.score >= chosen.start + gs.i * chosen.width
          and s.score < chosen.start + (gs.i + 1) * chosen.width
      ) as n
    from chosen,
      generate_series(0, 7) as gs(i)
  )
  select jsonb_build_object(
    'bins',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('lo', lo, 'hi', hi, 'count', n)
          order by lo
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
