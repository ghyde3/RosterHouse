"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toaster";
import type { PositionRow } from "@/lib/queries/positions";
import styles from "./PositionsView.module.css";

type PositionsViewProps = {
  active: PositionRow[];
  archived: PositionRow[];
};

async function callJson(url: string, method: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await res.json();
  if (!parsed.ok) throw new Error(parsed.error?.message ?? "Something went wrong");
}

export function PositionsView({ active, archived }: PositionsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | undefined>(undefined);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, failTitle: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      toast({
        tone: "danger",
        title: failTitle,
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function addPosition() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError("Name your position");
      return;
    }
    setAddError(undefined);
    await run(async () => {
      await callJson("/api/positions", "POST", { name: trimmed });
      setNewName("");
      toast({ tone: "success", title: "Position added" });
    }, "Couldn't add position");
  }

  function reorder(ids: string[]) {
    return run(async () => {
      await callJson("/api/positions/reorder", "PATCH", { orderedIds: ids });
    }, "Couldn't reorder");
  }

  function move(index: number, delta: -1 | 1) {
    const ids = active.map((p) => p.id);
    const swapWith = index + delta;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    void reorder(ids);
  }

  function archive(id: string, archivedNext: boolean) {
    return run(async () => {
      await callJson(`/api/positions/${id}`, "PATCH", { archived: archivedNext });
      toast({ tone: "success", title: archivedNext ? "Position archived" : "Position restored" });
    }, archivedNext ? "Couldn't archive" : "Couldn't restore");
  }

  function startRename(row: PositionRow) {
    setRenamingId(row.id);
    setRenameValue(row.name);
    setRenameError(undefined);
  }

  async function saveRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Name your position");
      return;
    }
    await run(async () => {
      await callJson(`/api/positions/${id}`, "PATCH", { name: trimmed });
      setRenamingId(null);
      toast({ tone: "success", title: "Position renamed" });
    }, "Couldn't rename");
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Positions</h1>
        <div className={styles.subtitle}>
          The roles you schedule for. Archived roles stay on past shifts but disappear from new scheduling.
        </div>
      </div>

      <div className={styles.addRow}>
        <Input
          className={styles.addInput}
          placeholder="Add a position"
          aria-label="New position name"
          value={newName}
          error={addError}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addPosition();
          }}
        />
        <Button variant="primary" onClick={() => void addPosition()} disabled={busy}>
          Add
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState title="No active positions" description="Add your first role above." />
      ) : (
        <div className={styles.list}>
          {active.map((row, index) => (
            <div key={row.id} className={styles.row}>
              <div className={styles.reorder}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`Move ${row.name} up`}
                  disabled={index === 0 || busy}
                  onClick={() => move(index, -1)}
                >
                  <Icon name="chevron-up" size={14} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`Move ${row.name} down`}
                  disabled={index === active.length - 1 || busy}
                  onClick={() => move(index, 1)}
                >
                  <Icon name="chevron-down" size={14} />
                </button>
              </div>

              {renamingId === row.id ? (
                <>
                  <Input
                    className={styles.renameField}
                    aria-label={`New name for ${row.name}`}
                    value={renameValue}
                    error={renameError}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename(row.id);
                    }}
                  />
                  <div className={styles.rowActions}>
                    <Button variant="primary" size="sm" onClick={() => void saveRename(row.id)} disabled={busy}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRenamingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className={styles.name}>{row.name}</span>
                  <div className={styles.rowActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Rename ${row.name}`}
                      onClick={() => startRename(row)}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Archive ${row.name}`}
                      onClick={() => void archive(row.id, true)}
                      disabled={busy}
                    >
                      Archive
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            className={styles.archivedToggle}
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            <Icon name={showArchived ? "chevron-down" : "chevron-right"} size={16} />
            Archived ({archived.length})
          </button>
          {showArchived && (
            <div className={styles.list} style={{ marginTop: "8px" }}>
              {archived.map((row) => (
                <div key={row.id} className={`${styles.row} ${styles.rowArchived}`}>
                  <span className={styles.name}>{row.name}</span>
                  <Badge tone="neutral">Archived</Badge>
                  <div className={styles.rowActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void archive(row.id, false)}
                      disabled={busy}
                    >
                      Unarchive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
