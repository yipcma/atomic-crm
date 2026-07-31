--
-- Email verification, organization enable/disable (superadmin), and @mentions.
--

-- Email verification. Existing accounts are treated as already verified so the
-- new requirement never locks anyone out.
alter table public.users add column if not exists email_verified boolean not null default false;
update public.users set email_verified = true;

-- Superadmin can disable an organization (its members then cannot sign in).
alter table public.organizations add column if not exists disabled boolean not null default false;

-- @mentions: sales ids mentioned on a note or task.
alter table public.contact_notes add column if not exists mentions bigint[];
alter table public.deal_notes add column if not exists mentions bigint[];
alter table public.tasks add column if not exists mentions bigint[];

create index if not exists contact_notes_mentions_idx on public.contact_notes using gin (mentions);
create index if not exists deal_notes_mentions_idx on public.deal_notes using gin (mentions);
create index if not exists tasks_mentions_idx on public.tasks using gin (mentions);
