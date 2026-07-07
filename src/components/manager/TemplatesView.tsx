"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ApplyTemplateDialog from "@/components/schedule/ApplyTemplateDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toaster";
import type { EmployeeOption } from "@/lib/schedule-data";
import type { TemplateSummary } from "@/lib/template-data";
import type { ISODate } from "@/lib/time";
import styles from "./TemplatesView.module.css";

export function templateSubtitle(t: TemplateSummary): string {
  const when = new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${t.rowCount} shift${t.rowCount === 1 ? "" : "s"} · updated ${when}`;
}

type TemplatesViewProps = {
  currentWeek: ISODate;
  employees: EmployeeOption[];
  templates: TemplateSummary[];
};

export function TemplatesView({ currentWeek, employees, templates }: TemplatesViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TemplateSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummary | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  async function createTemplate() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Name your template");
    try {
      const res = await fetch("/api/schedule-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, rows: [] }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      setNewOpen(false);
      router.push(`/manager/templates/${body.data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function renameTemplate() {
    if (!renameTarget) return;
    const trimmed = name.trim();
    if (!trimmed) return setError("Name your template");
    const target = renameTarget;
    setRenameTarget(null);
    try {
      const res = await fetch(`/api/schedule-templates/${target.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template renamed" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't rename", description: err instanceof Error ? err.message : "Try again." });
    }
  }

  async function removeTemplate() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/schedule-templates/${target.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      toast({ tone: "success", title: "Template deleted" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't delete", description: err instanceof Error ? err.message : "Try again." });
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Templates</h1>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setApplyOpen(true)} disabled={templates.length === 0}>
            Apply a template
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setName("");
              setError(undefined);
              setNewOpen(true);
            }}
          >
            New template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Save a week from the schedule, or create one here, to reuse staffing patterns."
        />
      ) : (
        <div className={styles.grid}>
          {templates.map((t) => (
            <Card key={t.id} className={styles.card}>
              <div>
                <div className={styles.name}>{t.name}</div>
                <div className={styles.subtitle}>{templateSubtitle(t)}</div>
              </div>
              <div className={styles.cardActions}>
                <Link href={`/manager/templates/${t.id}`} className={styles.editLink}>
                  Edit
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setName(t.name);
                    setError(undefined);
                    setRenameTarget(t);
                  }}
                >
                  Rename
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(t)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={createTemplate}>Create</Button>
          </>
        }
      >
        <Input label="Template name" placeholder="e.g. Weekend crew" value={name} onChange={(e) => setName(e.target.value)} error={error} />
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={renameTemplate}>Save</Button>
          </>
        }
      >
        <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete template?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={removeTemplate}>Delete template</Button>
          </>
        }
      >
        <p>&quot;{deleteTarget?.name}&quot; will be removed. Shifts you already created from it stay put.</p>
      </Dialog>

      <ApplyTemplateDialog open={applyOpen} week={currentWeek} employees={employees} onClose={() => setApplyOpen(false)} />
    </div>
  );
}
