import { formatDistance } from "date-fns";
import { AtSign } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { Contact, ContactNote, DealNote, Task } from "../types";

const MENTIONS_SHOWN = 5;

type MentionItem =
  | ({ _kind: "contactNote"; _date: string | null } & ContactNote)
  | ({ _kind: "dealNote"; _date: string | null } & DealNote)
  | ({ _kind: "task"; _date: string | null } & Task);

// Sorts most-recent first, with undated items last. `due_date` is nullable in
// the database even though the Task type claims otherwise, so a mentioned task
// with no due date must not be treated as an epoch-zero date -- nor passed to
// formatDistance, which throws RangeError on an invalid value.
export function byRecency(a: MentionItem, b: MentionItem): number {
  if (!a._date && !b._date) return 0;
  if (!a._date) return 1;
  if (!b._date) return -1;
  return new Date(b._date).valueOf() - new Date(a._date).valueOf();
}

/**
 * Dashboard widget listing notes and tasks where the current user was
 * mentioned by a teammate.
 */
export const MentionsList = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const enabled = Number.isInteger(identity?.id);
  // ra-data-postgrest array-contains: value is a Postgres array literal.
  const mentionFilter = { "mentions@cs": `{${identity?.id}}` };

  const { data: contactNotesData, isPending: contactNotesLoading } = useGetList(
    "contact_notes",
    {
      pagination: { page: 1, perPage: MENTIONS_SHOWN },
      sort: { field: "date", order: "DESC" },
      filter: mentionFilter,
    },
    { enabled },
  );
  const { data: dealNotesData, isPending: dealNotesLoading } = useGetList(
    "deal_notes",
    {
      pagination: { page: 1, perPage: MENTIONS_SHOWN },
      sort: { field: "date", order: "DESC" },
      filter: mentionFilter,
    },
    { enabled },
  );
  const { data: tasksData, isPending: tasksLoading } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: MENTIONS_SHOWN },
      // Not due_date: sorting by it DESC returns the tasks due FURTHEST IN THE
      // FUTURE, not the most recent mentions, and puts undated ones last
      // regardless. tasks has no created_at, so the identity column is the
      // available proxy for creation order.
      sort: { field: "id", order: "DESC" },
      filter: mentionFilter,
    },
    { enabled },
  );

  if (contactNotesLoading || dealNotesLoading || tasksLoading) {
    // A fixed-height placeholder, so the dashboard does not reflow when this
    // widget resolves.
    return (
      <div>
        <div className="flex items-center mb-4">
          <div className="ml-8 mr-8 flex">
            <AtSign className="text-muted-foreground w-6 h-6" aria-hidden />
          </div>
          <Skeleton className="h-6 w-40" />
        </div>
        <Card>
          <CardContent>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="mb-8 last:mb-0 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!contactNotesData || !dealNotesData || !tasksData) {
    return null;
  }

  const items: MentionItem[] = [
    ...contactNotesData.map((note) => ({
      ...(note as ContactNote),
      _kind: "contactNote" as const,
      _date: note.date ?? null,
    })),
    ...dealNotesData.map((note) => ({
      ...(note as DealNote),
      _kind: "dealNote" as const,
      _date: note.date ?? null,
    })),
    ...tasksData.map((task) => ({
      ...(task as Task),
      _kind: "task" as const,
      _date: task.due_date ?? null,
    })),
  ]
    .sort(byRecency)
    .slice(0, MENTIONS_SHOWN);

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="mentions-heading">
      <div className="flex items-center mb-4">
        <div className="ml-8 mr-8 flex">
          <AtSign className="text-muted-foreground w-6 h-6" aria-hidden />
        </div>
        <h2
          id="mentions-heading"
          className="text-xl font-semibold text-muted-foreground"
        >
          {translate("crm.dashboard.mentions", { _: "You were mentioned" })}
        </h2>
      </div>
      <Card>
        <CardContent>
          {items.map((item) => (
            <div
              id={`${item._kind}_${item.id}`}
              key={`${item._kind}_${item.id}`}
              className="mb-8 last:mb-0"
            >
              <div className="text-sm text-muted-foreground">
                {item._kind === "dealNote" ? (
                  <Deal note={item} />
                ) : item._kind === "task" ? (
                  <TaskRef task={item} />
                ) : (
                  <ContactRef note={item} />
                )}
                {item._date
                  ? `, ${formatDistance(new Date(item._date), new Date(), {
                      addSuffix: true,
                    })}`
                  : null}
              </div>
              <div>
                <p className="text-sm line-clamp-3 overflow-hidden">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
};

const Deal = ({ note }: { note: DealNote }) => {
  const translate = useTranslate();
  return (
    <>
      {translate("resources.deals.forcedCaseName")}{" "}
      <ReferenceField
        record={note}
        source="deal_id"
        reference="deals"
        link="show"
      >
        <TextField source="name" />
      </ReferenceField>
    </>
  );
};

const ContactRef = ({ note }: { note: ContactNote }) => {
  const translate = useTranslate();
  return (
    <>
      {translate("resources.contacts.forcedCaseName")}{" "}
      <ReferenceField<ContactNote, Contact>
        record={note}
        source="contact_id"
        reference="contacts"
        link="show"
      >
        <TextField source="first_name" /> <TextField source="last_name" />
      </ReferenceField>
    </>
  );
};

const TaskRef = ({ task }: { task: Task }) => {
  const translate = useTranslate();
  return (
    <>
      {translate("resources.tasks.name", { smart_count: 1, _: "Task" })}{" "}
      <ReferenceField
        record={task}
        source="contact_id"
        reference="contacts"
        link="show"
      >
        <TextField source="first_name" /> <TextField source="last_name" />
      </ReferenceField>
    </>
  );
};
