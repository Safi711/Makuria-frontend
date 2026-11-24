-- مرجع المعادلة القانونية (امتحان تنظيم مهنة القانون) — المرحلة الأولى
-- Drafted 2026-11-23. NOT APPLIED. Apply only after Safi's written approval.
--
-- Model
--   eq_subjects  ← eq_topics
--   eq_subjects  ← eq_papers ← eq_questions ← eq_solutions ← eq_citations → articles
--
-- Visibility (enforced here, not in the app):
--   * A student (anon or signed in) sees a paper only when papers.status = 'published'.
--   * They see its questions only through a published paper.
--   * They see a solution only when solutions.review_status = 'published' AND its
--     paper is published. Publishing a paper does not publish its solutions.
--   * Editors (eq_editors) read and write everything, including drafts.
--   Editors are a separate list from admin_users on purpose: Safi asked that only
--   his account edit this reference at first.

-- ---------------------------------------------------------------------------
-- Editors
create table if not exists public.eq_editors (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  granted_at timestamptz not null default now(),
  notes      text
);
alter table public.eq_editors enable row level security;
-- No policies: the table is reachable only through is_eq_editor().

create or replace function public.is_eq_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.eq_editors where user_id = auth.uid());
$$;
revoke all on function public.is_eq_editor() from public;
grant execute on function public.is_eq_editor() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Subjects and topics
create table if not exists public.eq_subjects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_ar       text not null,
  description_ar text,
  law_slugs     text[] not null default '{}',   -- laws.slug of the governing statutes
  display_order int not null default 0
);

create table if not exists public.eq_topics (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.eq_subjects(id) on delete cascade,
  name_ar       text not null,
  articles_hint text,                           -- e.g. "م58" — a label, not a link
  frequency     int,                            -- sessions it appeared in (analysis doc)
  display_order int not null default 0,
  unique (subject_id, name_ar)
);

-- ---------------------------------------------------------------------------
-- Papers
create table if not exists public.eq_papers (
  id             uuid primary key default gen_random_uuid(),
  subject_id     uuid not null references public.eq_subjects(id),
  exam_year      int check (exam_year between 1990 and 2100),
  session_month  text check (session_month in ('فبراير','مارس','يوليو','أغسطس','ديسمبر','أخرى')),
  title_ar       text,
  status         text not null default 'draft'
                   check (status in ('draft','published','archived')),
  completeness   text not null default 'unknown'
                   check (completeness in ('complete','incomplete','doubtful','unknown')),
  completeness_note text,
  source_note    text,                          -- where the copy came from
  needs_review   boolean not null default true,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz
);
create index if not exists eq_papers_subject_idx on public.eq_papers(subject_id, exam_year desc);

-- Editor-only working fields, kept in their own table so no student-facing
-- grant can ever reach them (column-level revokes don't override Supabase's
-- table-level grants).
create table if not exists public.eq_paper_internal (
  paper_id       uuid primary key references public.eq_papers(id) on delete cascade,
  ocr_text       text,
  review_note    text,
  original_paths text[] not null default '{}',  -- objects in storage bucket eq-originals
  import_key     text unique                    -- set by the bulk import, keeps it idempotent
);

-- ---------------------------------------------------------------------------
-- Questions
create table if not exists public.eq_questions (
  id            uuid primary key default gen_random_uuid(),
  paper_id      uuid not null references public.eq_papers(id) on delete cascade,
  position      int not null,
  label_ar      text,                           -- "السؤال الأول"
  qtype         text not null default 'essay'
                  check (qtype in ('essay','practical','mcq','calculation','terms','errors','other')),
  is_compulsory boolean not null default false,
  marks         numeric,
  body_ar       text not null,
  topic_id      uuid references public.eq_topics(id) on delete set null,
  text_verified boolean not null default false, -- article numbers / dates checked against the original
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (paper_id, position)
);

-- ---------------------------------------------------------------------------
-- Solutions (several per question: official, Makuria's guidance, external)
create table if not exists public.eq_solutions (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references public.eq_questions(id) on delete cascade,
  kind            text not null default 'makuria'
                    check (kind in ('official','makuria','external')),
  review_status   text not null default 'draft'
                    check (review_status in ('draft','in_review','published')),
  -- the four-point structure
  issue_ar        text,   -- ماذا يطلب السؤال
  rules_ar        text,   -- القواعد
  application_ar  text,   -- التطبيق
  conclusion_ar   text,   -- النتيجة
  author_name     text,
  external_source text,   -- required for kind = 'external'
  permission_note text,   -- required for kind = 'external' before publishing
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  created_by      uuid references auth.users(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint eq_solutions_external_attribution check (
    kind <> 'external' or review_status <> 'published'
    or (external_source is not null and permission_note is not null)
  ),
  constraint eq_solutions_published_reviewed check (
    review_status <> 'published' or reviewed_at is not null
  )
);
create index if not exists eq_solutions_question_idx on public.eq_solutions(question_id);

create table if not exists public.eq_citations (
  id            uuid primary key default gen_random_uuid(),
  solution_id   uuid not null references public.eq_solutions(id) on delete cascade,
  article_id    uuid references public.articles(id) on delete set null,
  law_slug      text,
  article_label text,          -- "م58(1)" as printed in the solution
  note_ar       text,          -- e.g. how the text read in the exam year
  position      int not null default 0
);
create index if not exists eq_citations_solution_idx on public.eq_citations(solution_id);

-- ---------------------------------------------------------------------------
-- updated_at
create or replace function public.eq_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists eq_papers_touch on public.eq_papers;
create trigger eq_papers_touch before update on public.eq_papers
  for each row execute function public.eq_touch_updated_at();
drop trigger if exists eq_questions_touch on public.eq_questions;
create trigger eq_questions_touch before update on public.eq_questions
  for each row execute function public.eq_touch_updated_at();
drop trigger if exists eq_solutions_touch on public.eq_solutions;
create trigger eq_solutions_touch before update on public.eq_solutions
  for each row execute function public.eq_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
alter table public.eq_subjects  enable row level security;
alter table public.eq_topics    enable row level security;
alter table public.eq_papers    enable row level security;
alter table public.eq_questions enable row level security;
alter table public.eq_solutions enable row level security;
alter table public.eq_citations enable row level security;

-- subjects and topics: readable by all, editable by editors
create policy eq_subjects_read  on public.eq_subjects  for select using (true);
create policy eq_subjects_write on public.eq_subjects  for all using (public.is_eq_editor()) with check (public.is_eq_editor());
create policy eq_topics_read    on public.eq_topics    for select using (true);
create policy eq_topics_write   on public.eq_topics    for all using (public.is_eq_editor()) with check (public.is_eq_editor());

-- papers
create policy eq_papers_read_published on public.eq_papers for select
  using (status = 'published' or public.is_eq_editor());
create policy eq_papers_write on public.eq_papers for all
  using (public.is_eq_editor()) with check (public.is_eq_editor());

-- questions: through a published paper
create policy eq_questions_read on public.eq_questions for select
  using (
    public.is_eq_editor()
    or exists (select 1 from public.eq_papers p where p.id = paper_id and p.status = 'published')
  );
create policy eq_questions_write on public.eq_questions for all
  using (public.is_eq_editor()) with check (public.is_eq_editor());

-- solutions: published solution on a published paper
create policy eq_solutions_read on public.eq_solutions for select
  using (
    public.is_eq_editor()
    or (
      review_status = 'published'
      and exists (
        select 1 from public.eq_questions q join public.eq_papers p on p.id = q.paper_id
        where q.id = question_id and p.status = 'published'
      )
    )
  );
create policy eq_solutions_write on public.eq_solutions for all
  using (public.is_eq_editor()) with check (public.is_eq_editor());

create policy eq_citations_read on public.eq_citations for select
  using (
    public.is_eq_editor()
    or exists (
      select 1 from public.eq_solutions s
      join public.eq_questions q on q.id = s.question_id
      join public.eq_papers p on p.id = q.paper_id
      where s.id = solution_id and s.review_status = 'published' and p.status = 'published'
    )
  );
create policy eq_citations_write on public.eq_citations for all
  using (public.is_eq_editor()) with check (public.is_eq_editor());

alter table public.eq_paper_internal enable row level security;
create policy eq_paper_internal_editor on public.eq_paper_internal for all
  using (public.is_eq_editor()) with check (public.is_eq_editor());

-- ---------------------------------------------------------------------------
-- Storage: originals (scans) are private, editors only.
insert into storage.buckets (id, name, public)
values ('eq-originals', 'eq-originals', false)
on conflict (id) do nothing;

create policy eq_originals_editor_all on storage.objects for all
  using (bucket_id = 'eq-originals' and public.is_eq_editor())
  with check (bucket_id = 'eq-originals' and public.is_eq_editor());

-- ---------------------------------------------------------------------------
-- Seed: subjects (order as in the analysis document)
insert into public.eq_subjects (slug, name_ar, law_slugs, display_order) values
  ('criminal-procedure', 'الإجراءات الجنائية', '{criminal-procedure-1991}', 1),
  ('criminal-law',       'القانون الجنائي',     '{criminal-law-1991}', 2),
  ('personal-status',    'الأحوال الشخصية للمسلمين', '{personal-status-muslims-1991}', 3),
  ('evidence',           'الإثبات',            '{evidence-law-1993}', 4),
  ('contracts',          'العقود (المعاملات المدنية)', '{civil-transactions-1984}', 5),
  ('civil-procedure',    'الإجراءات المدنية',    '{civil-procedure-1983}', 6),
  ('usul-al-fiqh',       'أصول الفقه',          '{}', 7)
on conflict (slug) do nothing;

-- Seed: the first editor — Safi's account only: the row admin_users marks as
-- the primary admin (not the break-glass backup). No email is written here
-- because this repository is public.
insert into public.eq_editors (user_id, email, notes)
select user_id, email, 'المحرر الأول — بطلب صافي 2026-11-23'
from public.admin_users
where notes like 'Primary admin%'
on conflict (user_id) do nothing;
