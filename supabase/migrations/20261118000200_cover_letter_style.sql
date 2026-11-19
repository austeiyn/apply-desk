-- Cover letter styles: the same templates and accent colours as resumes
-- (lib/documents/templates.ts). Null means "match the application's resume,
-- or Classic".
alter table public.generated_cover_letters
  add column style jsonb
  check (
    style is null
    or (
      jsonb_typeof(style) = 'object'
      and style ->> 'template' in ('classic', 'modern', 'executive', 'compact')
      and (style -> 'accent' is null or style ->> 'accent' in ('charcoal', 'navy', 'teal', 'forest', 'burgundy', 'plum'))
    )
  );
