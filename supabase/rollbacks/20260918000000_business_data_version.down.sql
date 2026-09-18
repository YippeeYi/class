drop function if exists public.get_class_data_version();
do $$
declare name text;
begin
    foreach name in array array['class_records', 'class_people', 'class_record_pages',
      'class_page_messages', 'class_page_supplements', 'class_materials',
      'class_quiz_questions', 'class_credits_page', 'class_private_assets']
    loop
        execute format('drop trigger if exists business_data_changed on public.%I', name);
    end loop;
end;
$$;
drop function if exists public.bump_class_data_version();
drop table if exists public.class_data_version;
notify pgrst, 'reload schema';
