create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('student','admin')),
  body text not null check (length(body) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_student_idx on public.support_messages(student_id, created_at);
alter table public.support_messages enable row level security;
create policy "read own or admin" on public.support_messages for select to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "send own or admin" on public.support_messages for insert to authenticated
  with check ((student_id = auth.uid() and sender = 'student') or (public.has_role(auth.uid(), 'admin') and sender = 'admin'));
create policy "mark read" on public.support_messages for update to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admin delete" on public.support_messages for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
grant select, insert, update, delete on public.support_messages to authenticated;
alter publication supabase_realtime add table public.support_messages;
create policy "admin delete notifications" on public.admin_notifications for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
grant delete on public.admin_notifications to authenticated;
