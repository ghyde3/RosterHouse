"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { TimeField } from "@/components/ui/TimeField";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toaster";
import type { AvailabilityRuleDto } from "@/lib/queries/employee";
import { DAY_NAMES, editorReducer, initEditor, toDto } from "./reducer";
import s from "./availability.module.css";
import ui from "@/components/employee/employee.module.css";

const PRESETS = [
  { key: "everyday", label: "Every day" },
  { key: "weekdays", label: "Weekdays only" },
  { key: "weekends", label: "Weekends only" },
] as const;

export function AvailabilityEditor({ initialRules }: { initialRules: AvailabilityRuleDto[] }) {
  const [state, dispatch] = useReducer(editorReducer, initialRules, initEditor);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [saving, setSaving] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const dirtyRef = useRef(state.dirty);
  dirtyRef.current = state.dirty;

  // Unsaved-changes guard: while dirty, intercept in-app link taps (tab bar,
  // bell — all real anchors) and hard reloads.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    function onClickCapture(e: MouseEvent) {
      if (!dirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  async function save() {
    const result = toDto(state.days);
    if (!result.ok) {
      dispatch({ type: "setErrors", errors: result.errors });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: result.rules }),
      });
      const body = await res.json();
      if (!body.ok) {
        toast({ tone: "danger", title: "Couldn't save your availability", description: body.error.message });
        return;
      }
      dispatch({ type: "markSaved" });
      toast({ tone: "success", title: "Availability saved" });
    } catch {
      toast({
        tone: "danger",
        title: "Couldn't save your availability",
        description: "Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  function discardAndGo() {
    const href = pendingHref;
    setPendingHref(null);
    if (!href) return;
    dispatch({ type: "markSaved" }); // neutralize the guard; we're leaving
    router.push(href);
  }

  return (
    <>
      <div className={ui.muted}>Your weekly availability repeats every week until you change it.</div>

      <div className={s.presets}>
        {PRESETS.map((p) => (
          <Button key={p.key} variant="secondary" size="sm" onClick={() => dispatch({ type: "applyPreset", preset: p.key })}>
            {p.label}
          </Button>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: "simple", label: "Simple" },
          { value: "advanced", label: "Advanced" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as "simple" | "advanced")}
      />

      {mode === "simple" && (
        <Card>
          <div className={ui.cardStack}>
            {state.days.map((d) => (
              <Switch
                key={d.dayOfWeek}
                label={DAY_NAMES[d.dayOfWeek]}
                checked={d.isAvailable}
                onChange={() => dispatch({ type: "toggleDay", dayOfWeek: d.dayOfWeek })}
              />
            ))}
          </div>
        </Card>
      )}

      {mode === "advanced" && (
        <Card>
          <div className={ui.cardStack}>
            <div className={s.hint}>Leave both times blank if you&apos;re available all day.</div>
            {state.days.map((d) => (
              <div key={d.dayOfWeek} className={s.dayRow}>
                <Switch
                  label={DAY_NAMES[d.dayOfWeek]}
                  checked={d.isAvailable}
                  onChange={() => dispatch({ type: "toggleDay", dayOfWeek: d.dayOfWeek })}
                />
                {d.isAvailable && (
                  <div className={s.times}>
                    <div className={s.timeField}>
                      <TimeField
                        label="Start"
                        placeholder="9:00 AM"
                        value={d.start}
                        onChange={(v) => dispatch({ type: "setTime", dayOfWeek: d.dayOfWeek, field: "start", value: v })}
                      />
                    </div>
                    <div className={s.timeField}>
                      <TimeField
                        label="End"
                        placeholder="5:00 PM"
                        value={d.end}
                        onChange={(v) => dispatch({ type: "setTime", dayOfWeek: d.dayOfWeek, field: "end", value: v })}
                      />
                    </div>
                  </div>
                )}
                {state.errors[d.dayOfWeek] && (
                  <div className={s.dayError} role="alert">
                    {state.errors[d.dayOfWeek]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className={s.saveBar}>
        <Button variant="primary" fullWidth disabled={!state.dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save availability"}
        </Button>
      </div>

      <Sheet open={pendingHref !== null} onClose={() => setPendingHref(null)} title="Discard unsaved changes?">
        <div className={ui.muted}>Your availability changes haven&apos;t been saved.</div>
        <div className={s.sheetActions}>
          <Button variant="secondary" fullWidth onClick={() => setPendingHref(null)}>
            Keep editing
          </Button>
          <Button variant="danger" fullWidth onClick={discardAndGo}>
            Discard changes
          </Button>
        </div>
      </Sheet>
    </>
  );
}
