-- Make Postgres itself reject cross-tenant relationships.
--
-- Until now every foreign key referenced a bare id, so a row in org A could
-- legally point at a parent in org B. That is what made the contacts_summary
-- leak reachable (0005 fixes the read side; this fixes the write side), and it
-- also meant org B deleting a record could cascade-delete org A's data.
--
-- The fix is a composite key: (child_id, organization_id) must match an existing
-- (id, organization_id) on the parent. Same-org relationships are unaffected;
-- cross-org ones become impossible to write.
--
-- MATCH SIMPLE (the default) is deliberate and load-bearing: every FK column
-- here is nullable while organization_id is NOT NULL, and under MATCH SIMPLE a
-- row with a NULL child id is exempt from the check. That preserves the existing
-- "contact with no company" and "record with no owner" semantics. MATCH FULL
-- would reject every one of those rows.

-- Fail loudly and readably if any pre-existing row already crosses tenants.
-- These need a human decision (null out, reassign, or delete); the migration
-- must not silently mutate data.
do $$
declare
    violations text;
begin
    select string_agg(format('%s id=%s', rel, id), ', ')
      into violations
      from (
        select 'contacts.company_id' as rel, c.id from public.contacts c
          join public.companies p on p.id = c.company_id
         where p.organization_id <> c.organization_id
        union all
        select 'deals.company_id', d.id from public.deals d
          join public.companies p on p.id = d.company_id
         where p.organization_id <> d.organization_id
        union all
        select 'tasks.contact_id', t.id from public.tasks t
          join public.contacts p on p.id = t.contact_id
         where p.organization_id <> t.organization_id
        union all
        select 'contact_notes.contact_id', n.id from public.contact_notes n
          join public.contacts p on p.id = n.contact_id
         where p.organization_id <> n.organization_id
        union all
        select 'deal_notes.deal_id', n.id from public.deal_notes n
          join public.deals p on p.id = n.deal_id
         where p.organization_id <> n.organization_id
        union all
        select 'companies.sales_id', c.id from public.companies c
          join public.sales p on p.id = c.sales_id
         where p.organization_id <> c.organization_id
        union all
        select 'contacts.sales_id', c.id from public.contacts c
          join public.sales p on p.id = c.sales_id
         where p.organization_id <> c.organization_id
        union all
        select 'deals.sales_id', d.id from public.deals d
          join public.sales p on p.id = d.sales_id
         where p.organization_id <> d.organization_id
        union all
        select 'contact_notes.sales_id', n.id from public.contact_notes n
          join public.sales p on p.id = n.sales_id
         where p.organization_id <> n.organization_id
        union all
        select 'deal_notes.sales_id', n.id from public.deal_notes n
          join public.sales p on p.id = n.sales_id
         where p.organization_id <> n.organization_id
      ) v;

    if violations is not null then
        raise exception
            'Cross-tenant references exist; resolve them before applying: %',
            violations;
    end if;
end $$;

-- A composite foreign key needs an explicitly unique target, even though
-- (id, organization_id) is already implied unique by the primary key.
alter table public.companies add constraint companies_id_org_key unique (id, organization_id);
alter table public.contacts  add constraint contacts_id_org_key  unique (id, organization_id);
alter table public.deals     add constraint deals_id_org_key     unique (id, organization_id);
alter table public.sales     add constraint sales_id_org_key     unique (id, organization_id);

-- Support the cascade scans on the child side.
create index if not exists contacts_company_org_idx      on public.contacts      (company_id, organization_id);
create index if not exists deals_company_org_idx         on public.deals         (company_id, organization_id);
create index if not exists tasks_contact_org_idx         on public.tasks         (contact_id, organization_id);
create index if not exists contact_notes_contact_org_idx on public.contact_notes (contact_id, organization_id);
create index if not exists deal_notes_deal_org_idx       on public.deal_notes    (deal_id,    organization_id);

-- Parent relations. on update/on delete actions are preserved exactly as they
-- were declared in 0001_init.sql.
alter table public.contacts drop constraint if exists contacts_company_id_fkey;
alter table public.contacts add constraint contacts_company_id_fkey
    foreign key (company_id, organization_id)
    references public.companies (id, organization_id)
    on update cascade on delete cascade;

alter table public.deals drop constraint if exists deals_company_id_fkey;
alter table public.deals add constraint deals_company_id_fkey
    foreign key (company_id, organization_id)
    references public.companies (id, organization_id)
    on update cascade on delete cascade;

alter table public.tasks drop constraint if exists tasks_contact_id_fkey;
alter table public.tasks add constraint tasks_contact_id_fkey
    foreign key (contact_id, organization_id)
    references public.contacts (id, organization_id)
    on update cascade on delete cascade;

alter table public.contact_notes drop constraint if exists contact_notes_contact_id_fkey;
alter table public.contact_notes add constraint contact_notes_contact_id_fkey
    foreign key (contact_id, organization_id)
    references public.contacts (id, organization_id)
    on update cascade on delete cascade;

alter table public.deal_notes drop constraint if exists deal_notes_deal_id_fkey;
alter table public.deal_notes add constraint deal_notes_deal_id_fkey
    foreign key (deal_id, organization_id)
    references public.deals (id, organization_id)
    on update cascade on delete cascade;

-- Ownership relations: a record must not be assigned to another tenant's user.
alter table public.companies drop constraint if exists companies_sales_id_fkey;
alter table public.companies add constraint companies_sales_id_fkey
    foreign key (sales_id, organization_id)
    references public.sales (id, organization_id);

alter table public.contacts drop constraint if exists contacts_sales_id_fkey;
alter table public.contacts add constraint contacts_sales_id_fkey
    foreign key (sales_id, organization_id)
    references public.sales (id, organization_id);

alter table public.deals drop constraint if exists deals_sales_id_fkey;
alter table public.deals add constraint deals_sales_id_fkey
    foreign key (sales_id, organization_id)
    references public.sales (id, organization_id);

alter table public.contact_notes drop constraint if exists contact_notes_sales_id_fkey;
alter table public.contact_notes add constraint contact_notes_sales_id_fkey
    foreign key (sales_id, organization_id)
    references public.sales (id, organization_id)
    on update cascade on delete cascade;

alter table public.deal_notes drop constraint if exists deal_notes_sales_id_fkey;
alter table public.deal_notes add constraint deal_notes_sales_id_fkey
    foreign key (sales_id, organization_id)
    references public.sales (id, organization_id);
