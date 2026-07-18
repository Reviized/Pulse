-- Storage buckets (Section 5): headshots re-hosted server-side (never hotlinked),
-- slide media, rendered replica video output, and generated title cards.
insert into storage.buckets (id, name, public)
values
  ('headshots', 'headshots', true),
  ('slide-media', 'slide-media', true),
  ('replicas', 'replicas', true),
  ('generated', 'generated', true)
on conflict (id) do nothing;

-- Public read on all four (they serve directly to the front-end deck); writes
-- are service-role only, matching every table's write policy in 0001.
create policy "public read headshots" on storage.objects for select using (bucket_id = 'headshots');
create policy "public read slide-media" on storage.objects for select using (bucket_id = 'slide-media');
create policy "public read replicas" on storage.objects for select using (bucket_id = 'replicas');
create policy "public read generated" on storage.objects for select using (bucket_id = 'generated');

create policy "service role write headshots" on storage.objects for insert with check (bucket_id = 'headshots' and auth.role() = 'service_role');
create policy "service role write slide-media" on storage.objects for insert with check (bucket_id = 'slide-media' and auth.role() = 'service_role');
create policy "service role write replicas" on storage.objects for insert with check (bucket_id = 'replicas' and auth.role() = 'service_role');
create policy "service role write generated" on storage.objects for insert with check (bucket_id = 'generated' and auth.role() = 'service_role');

create policy "service role update headshots" on storage.objects for update using (bucket_id = 'headshots' and auth.role() = 'service_role');
create policy "service role update slide-media" on storage.objects for update using (bucket_id = 'slide-media' and auth.role() = 'service_role');
create policy "service role update replicas" on storage.objects for update using (bucket_id = 'replicas' and auth.role() = 'service_role');
create policy "service role update generated" on storage.objects for update using (bucket_id = 'generated' and auth.role() = 'service_role');
