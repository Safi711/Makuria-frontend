-- RLS check for مرجع المعادلة. Run AFTER the migration. It raises an exception at
-- the end on purpose, so every row it inserts is rolled back; the exception
-- message is the result line. Expected:
--   anon papers=1 questions=1 solutions=1 internal=0 is_editor=false; anon_insert=denied
--   student papers=1 solutions=1 internal=0; student_publish_rows=0; student_insert=denied
--   editor papers=2 solutions=3 internal=1 is_editor=true; editor_insert=ok; external_no_permission=blocked

do $t$
declare
  ed uuid; stranger uuid := gen_random_uuid(); subj uuid;
  pub uuid; dra uuid; q1 uuid; q2 uuid; s_pub uuid; s_dra uuid;
  r text := ''; n int; ok boolean;
begin
  select user_id into ed from public.eq_editors limit 1;
  r := r || 'editor_seeded=' || (ed is not null) || '; ';
  select id into subj from public.eq_subjects where slug='criminal-procedure';
  r := r || 'subjects=' || (select count(*) from public.eq_subjects) || '; ';
  insert into public.eq_papers(subject_id, exam_year, session_month, status) values (subj, 2010, 'فبراير', 'published') returning id into pub;
  insert into public.eq_papers(subject_id, exam_year, session_month, status) values (subj, 2009, 'يوليو', 'draft') returning id into dra;
  insert into public.eq_paper_internal(paper_id, ocr_text) values (pub, 'سري');
  insert into public.eq_questions(paper_id, position, body_ar) values (pub, 1, 'س1') returning id into q1;
  insert into public.eq_questions(paper_id, position, body_ar) values (dra, 1, 'س2') returning id into q2;
  insert into public.eq_solutions(question_id, review_status, conclusion_ar, reviewed_at) values (q1, 'published', 'ن', now()) returning id into s_pub;
  insert into public.eq_solutions(question_id, review_status, conclusion_ar) values (q1, 'draft', 'م') returning id into s_dra;
  insert into public.eq_solutions(question_id, review_status, conclusion_ar, reviewed_at) values (q2, 'published', 'x', now());

  -- anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  r := r || 'anon papers=' || (select count(*) from public.eq_papers where id in (pub,dra))
        || ' questions=' || (select count(*) from public.eq_questions where id in (q1,q2))
        || ' solutions=' || (select count(*) from public.eq_solutions where question_id in (q1,q2))
        || ' internal=' || (select count(*) from public.eq_paper_internal where paper_id=pub)
        || ' is_editor=' || public.is_eq_editor() || '; ';
  begin
    insert into public.eq_papers(subject_id, status) values (subj, 'published');
    r := r || 'anon_insert=ALLOWED!; ';
  exception when others then r := r || 'anon_insert=denied; '; end;
  reset role;

  -- signed-in non-editor
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role','authenticated')::text, true);
  set local role authenticated;
  r := r || 'student papers=' || (select count(*) from public.eq_papers where id in (pub,dra))
        || ' solutions=' || (select count(*) from public.eq_solutions where question_id in (q1,q2))
        || ' internal=' || (select count(*) from public.eq_paper_internal)
        || ' is_editor=' || public.is_eq_editor() || '; ';
  update public.eq_papers set status='published' where id = dra;
  get diagnostics n = row_count;
  r := r || 'student_publish_rows=' || n || '; ';
  begin
    insert into public.eq_solutions(question_id, review_status, conclusion_ar) values (q1,'draft','hack');
    r := r || 'student_insert=ALLOWED!; ';
  exception when others then r := r || 'student_insert=denied; '; end;
  reset role;

  -- editor
  perform set_config('request.jwt.claims', json_build_object('sub', ed, 'role','authenticated')::text, true);
  set local role authenticated;
  r := r || 'editor papers=' || (select count(*) from public.eq_papers where id in (pub,dra))
        || ' solutions=' || (select count(*) from public.eq_solutions where question_id in (q1,q2))
        || ' internal=' || (select count(*) from public.eq_paper_internal where paper_id=pub)
        || ' is_editor=' || public.is_eq_editor() || '; ';
  insert into public.eq_papers(subject_id, status) values (subj, 'draft');
  r := r || 'editor_insert=ok; ';
  begin
    insert into public.eq_solutions(question_id, kind, review_status, conclusion_ar, reviewed_at) values (q1,'external','published','x', now());
    r := r || 'external_no_permission=ALLOWED!; ';
  exception when check_violation then r := r || 'external_no_permission=blocked; '; end;
  reset role;

  raise exception 'RESULT(rolled back): %', r;
end $t$;
