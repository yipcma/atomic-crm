import { formatDistance } from "date-fns";
import { AtSign } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Card, CardContent } from "@/components/ui/card";

import type { Contact, ContactNote } from "../types";

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
      pagination: { page: 1, perPage: 5 },
      sort: { field: "date", order: "DESC" },
      filter: mentionFilter,
    },
    { enabled },
  );
  const { data: dealNotesData, isPending: dealNotesLoading } = useGetList(
    "deal_notes",
    {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "date", order: "DESC" },
      filter: mentionFilter,
    },
    { enabled },
  );
  const { data: tasksData, isPending: tasksLoading } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "due_date", order: "DESC" },
      filter: mentionFilter,
    },
    { enabled },
  );

  if (contactNotesLoading || dealNotesLoading || tasksLoading) {
    return null;
  }
  if (!contactNotesData || !dealNotesData || !tasksData) {
    return null;
  }

  const items = ([] as any[])
    .concat(
      contactNotesData.map((note) => ({
        ...note,
        _kind: "contactNote",
        _date: note.date,
      })),
      dealNotesData.map((note) => ({
        ...note,
        _kind: "dealNote",
        _date: note.date,
      })),
      tasksData.map((task) => ({
        ...task,
        _kind: "task",
        _date: task.due_date,
      })),
    )
    .sort((a, b) => new Date(b._date).valueOf() - new Date(a._date).valueOf())
    .slice(0, 5);

  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <div className="ml-8 mr-8 flex">
          <AtSign className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
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
                  <Task task={item} />
                ) : (
                  <ContactRef note={item} />
                )}
                {", "}
                {formatDistance(item._date, new Date(), { addSuffix: true })}
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
    </div>
  );
};

const Deal = ({ note }: any) => {
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

const ContactRef = ({ note }: any) => {
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

const Task = ({ task }: any) => {
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
