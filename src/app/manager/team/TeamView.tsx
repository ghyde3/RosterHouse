"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarStatus } from "@/components/ui/AvatarStatus";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toaster";
import type { PendingInvite, TeamMember } from "@/lib/team";

type PositionOption = { id: string; name: string };

type Props = {
  locationId: string;
  members: TeamMember[];
  pendingInvites: PendingInvite[];
  positions: PositionOption[];
};

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const AVATAR_STATUS: Record<TeamMember["status"], "available" | "pending" | "off"> = {
  active: "available",
  invited: "pending",
  inactive: "off",
};

export function TeamView({ locationId, members, pendingInvites, positions }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Invite link copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", description: url, tone: "danger" });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
            Team
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
            {members.length === 1 ? "1 team member" : `${members.length} team members`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen(true)}>
          Invite employee
        </Button>
      </div>

      {pendingInvites.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ fontSize: "var(--text-h3-size)", fontWeight: 700, color: "var(--text-primary)" }}>
            Pending invites
          </h2>
          {pendingInvites.map((invite) => (
            <Card key={invite.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{invite.name ?? invite.contact}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {invite.contact}
                  {invite.positionName ? ` · ${invite.positionName}` : ""}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => copyInviteLink(invite.token)}>
                Copy link
              </Button>
            </Card>
          ))}
        </section>
      )}

      {members.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Invite your first employee to start building schedules."
          action={
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              Invite employee
            </Button>
          }
        />
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map((member) => (
            <Card key={member.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <AvatarStatus name={member.name} status={AVATAR_STATUS[member.status]} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{member.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {member.primaryPositionName ?? "No position yet"}
                </div>
              </div>
              {member.status === "inactive" && <Badge tone="neutral">Deactivated</Badge>}
              {member.status === "invited" && <Badge tone="warning">Invited</Badge>}
              <Button variant="ghost" size="sm" onClick={() => setEditing(member)}>
                Edit
              </Button>
            </Card>
          ))}
        </section>
      )}

      <InviteEmployeeDialog
        open={inviteOpen}
        locationId={locationId}
        positions={positions}
        onClose={() => {
          setInviteOpen(false);
          router.refresh();
        }}
      />
      {editing && (
        <EditMemberDialog
          member={editing}
          positions={positions}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            toast({ title: message, tone: "success" });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function InviteEmployeeDialog({
  open,
  locationId,
  positions,
  onClose,
}: {
  open: boolean;
  locationId: string;
  positions: PositionOption[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function reset() {
    setName("");
    setContact("");
    setPositionId(positions[0]?.id ?? "");
    setError(null);
    setSubmitting(false);
    setInviteUrl(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleInvite() {
    setError(null);
    if (!name.trim()) return setError("Enter the employee's name.");
    if (!contact.trim()) return setError("Enter a phone number or email.");
    if (!positionId) return setError("Choose a position.");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/locations/${locationId}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), positionId }),
      });
      const body = (await res.json()) as ApiEnvelope<{ inviteUrl: string }>;
      if (!body.ok) {
        setError(body.error.message);
        return;
      }
      setInviteUrl(body.data.inviteUrl);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({ title: "Invite link copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", description: "Select the link and copy it manually.", tone: "danger" });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={inviteUrl ? "Invite created" : "Invite employee"}
      footer={
        inviteUrl ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInvite} disabled={submitting}>
              {submitting ? "Creating…" : "Create invite"}
            </Button>
          </>
        )
      }
    >
      {inviteUrl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Text or email this link to {name.trim() || "your employee"}. It expires in 14 days.
          </p>
          <Input label="Invite link" value={inviteUrl} onChange={() => undefined} />
          <Button variant="secondary" onClick={copy}>
            Copy link
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Name" placeholder="Riley Quinn" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Phone or email"
            placeholder="(555) 123-4567"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <Select
            label="Position"
            value={positionId}
            onChange={setPositionId}
            options={positions.map((p) => ({ value: p.id, label: p.name }))}
          />
          {error && (
            <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{error}</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function EditMemberDialog({
  member,
  positions,
  onClose,
  onSaved,
}: {
  member: TeamMember;
  positions: PositionOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [primaryPositionId, setPrimaryPositionId] = useState(member.primaryPositionId ?? "");
  const [positionIds, setPositionIds] = useState<string[]>(member.positionIds);
  const [hourlyRate, setHourlyRate] = useState(member.hourlyRate === null ? "" : String(member.hourlyRate));
  const [vacationBalance, setVacationBalance] = useState(
    member.vacationBalanceHours === null ? "" : String(member.vacationBalanceHours),
  );
  const [sickBalance, setSickBalance] = useState(
    member.sickBalanceHours === null ? "" : String(member.sickBalanceHours),
  );
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePosition(id: string, checked: boolean) {
    setPositionIds((current) => (checked ? [...current, id] : current.filter((p) => p !== id)));
  }

  async function patch(payload: Record<string, unknown>, successMessage: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employee-profiles/${member.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as ApiEnvelope<{ member: TeamMember }>;
      if (!body.ok) {
        setError(body.error.message);
        return;
      }
      onSaved(successMessage);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (hourlyRate.trim() !== "" && Number.isNaN(Number(hourlyRate))) {
      setError("Hourly rate needs to be a number, like 16.50.");
      return;
    }
    if (vacationBalance.trim() !== "" && Number.isNaN(Number(vacationBalance))) {
      setError("Vacation balance needs to be a number of hours, like 40.");
      return;
    }
    if (sickBalance.trim() !== "" && Number.isNaN(Number(sickBalance))) {
      setError("Sick balance needs to be a number of hours, like 24.");
      return;
    }
    await patch(
      {
        primaryPositionId: primaryPositionId || null,
        positionIds,
        hourlyRate: hourlyRate.trim() === "" ? null : Number(hourlyRate),
        vacationBalanceHours: vacationBalance.trim() === "" ? null : Number(vacationBalance),
        sickBalanceHours: sickBalance.trim() === "" ? null : Number(sickBalance),
      },
      "Changes saved",
    );
  }

  if (confirmingDeactivate) {
    return (
      <Dialog
        open
        onClose={() => setConfirmingDeactivate(false)}
        title={`Deactivate ${member.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingDeactivate(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => patch({ status: "inactive" }, `${member.name} deactivated`)} disabled={submitting}>
              {submitting ? "Deactivating…" : "Deactivate"}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          They&apos;ll no longer appear when you build schedules. You can reactivate them anytime.
        </p>
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)", marginTop: 10 }}>{error}</p>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={member.name}
      footer={
        <>
          {member.status === "inactive" ? (
            <Button variant="secondary" onClick={() => patch({ status: "active" }, `${member.name} reactivated`)} disabled={submitting}>
              Reactivate
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDeactivate(true)}>
              Deactivate
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Select
          label="Primary position"
          value={primaryPositionId}
          onChange={setPrimaryPositionId}
          options={positions.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Choose a position"
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Qualified positions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {positions.map((p) => (
              <Checkbox
                key={p.id}
                label={p.name}
                checked={positionIds.includes(p.id)}
                onChange={(checked) => togglePosition(p.id, checked)}
              />
            ))}
          </div>
        </div>
        <Input label="Hourly rate ($)" placeholder="16.50" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Vacation balance (hours)"
              placeholder="40"
              value={vacationBalance}
              onChange={(e) => setVacationBalance(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Sick balance (hours)"
              placeholder="24"
              value={sickBalance}
              onChange={(e) => setSickBalance(e.target.value)}
            />
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          Approved vacation and sick time is deducted automatically. Leave a balance blank to turn tracking off for
          that bucket.
        </p>
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--status-danger)" }}>{error}</p>
        )}
      </div>
    </Dialog>
  );
}
