-- Do not silently rewrite reviewed rules. Existing invalid rows must be
-- reviewed before this migration can complete.
begin;

alter table public.resolution_rules
  add constraint resolution_rules_reviewed_input_guard
  check (
    operation not in ('shift_days', 'suppress_shift')
    or (
      (expected_value is not null or expected_revision is not null)
      and (expected_value is null or expected_value ~ '[^[:space:]]')
      and (expected_revision is null or expected_revision > 0)
    )
  ) not valid;

alter table public.resolution_rules
  validate constraint resolution_rules_reviewed_input_guard;

commit;
