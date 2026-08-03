-- Constrain every join in the summary/activity views to the driving row's
-- organization.
--
-- Without this, a row whose foreign key points at another tenant's record leaks
-- that tenant's data through the joined columns. Concretely: contacts_summary
-- joined companies on company_id alone and selected c.name as company_name, so
-- a contact created in org A with a company_id belonging to org B returned org
-- B's company name -- and iterating company_id enumerated every tenant's
-- customer list. The org predicate below is what closes that; 0006 additionally
-- stops such a row from being written in the first place.
--
-- security_invoker is set now so the views respect row-level security if it is
-- ever adopted. It is a no-op today (the API connects as the table owner), but
-- setting it here means a future RLS migration does not have to re-touch them.

drop view if exists public.activity_log;
drop view if exists public.companies_summary;
drop view if exists public.contacts_summary;

create view public.companies_summary with (security_invoker = true) as
select
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    c.organization_id,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
from public.companies c
    left join public.deals d
        on c.id = d.company_id and d.organization_id = c.organization_id
    left join public.contacts co
        on c.id = co.company_id and co.organization_id = c.organization_id
group by c.id;

create view public.contacts_summary with (security_invoker = true) as
select
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    co.organization_id,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks
from public.contacts co
    left join public.tasks t
        on co.id = t.contact_id and t.organization_id = co.organization_id
    left join public.companies c
        on co.company_id = c.id and c.organization_id = co.organization_id
group by co.id, c.name;

create view public.activity_log with (security_invoker = true) as
select
    ('company.' || c.id || '.created') as id,
    'company.created' as type,
    c.created_at as date,
    c.id as company_id,
    c.sales_id,
    c.organization_id,
    to_json(c.*) as company,
    null::json as contact,
    null::json as deal,
    null::json as contact_note,
    null::json as deal_note
from public.companies c
union all
select
    ('contact.' || co.id || '.created') as id,
    'contact.created' as type,
    co.first_seen as date,
    co.company_id,
    co.sales_id,
    co.organization_id,
    null::json as company,
    to_json(co.*) as contact,
    null::json as deal,
    null::json as contact_note,
    null::json as deal_note
from public.contacts co
union all
select
    ('contactNote.' || cn.id || '.created') as id,
    'contactNote.created' as type,
    cn.date,
    co.company_id,
    cn.sales_id,
    cn.organization_id,
    null::json as company,
    null::json as contact,
    null::json as deal,
    to_json(cn.*) as contact_note,
    null::json as deal_note
from public.contact_notes cn
    left join public.contacts co
        on co.id = cn.contact_id and co.organization_id = cn.organization_id
union all
select
    ('deal.' || d.id || '.created') as id,
    'deal.created' as type,
    d.created_at as date,
    d.company_id,
    d.sales_id,
    d.organization_id,
    null::json as company,
    null::json as contact,
    to_json(d.*) as deal,
    null::json as contact_note,
    null::json as deal_note
from public.deals d
union all
select
    ('dealNote.' || dn.id || '.created') as id,
    'dealNote.created' as type,
    dn.date,
    d.company_id,
    dn.sales_id,
    dn.organization_id,
    null::json as company,
    null::json as contact,
    null::json as deal,
    null::json as contact_note,
    to_json(dn.*) as deal_note
from public.deal_notes dn
    left join public.deals d
        on d.id = dn.deal_id and d.organization_id = dn.organization_id;
