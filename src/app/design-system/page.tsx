"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStatus } from "@/components/ui/AvatarStatus";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import { TimeField } from "@/components/ui/TimeField";
import { Toast } from "@/components/ui/Toast";
import { ToasterProvider, useToast } from "@/components/ui/Toaster";
import { Tooltip } from "@/components/ui/Tooltip";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import { DatePager } from "@/components/chrome/DatePager";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import { EmployeeTopBar } from "@/components/chrome/EmployeeTopBar";
import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <h2
        style={{
          fontSize: "var(--text-h2-size)",
          fontWeight: "var(--text-h2-weight)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-5)",
      }}
    >
      {children}
    </div>
  );
}

const POSITIONS = [
  { value: "line-cook", label: "Line cook" },
  { value: "server", label: "Server" },
  { value: "dishwasher", label: "Dishwasher" },
  { value: "host", label: "Host" },
];

function ButtonsSection() {
  return (
    <Section title="Buttons">
      <Row>
        <Button>Publish schedule</Button>
        <Button variant="secondary">Save draft</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="accent">Claim shift</Button>
        <Button variant="danger">Delete shift</Button>
        <Button disabled>Publish schedule</Button>
      </Row>
      <Row>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button icon={<Icon name="plus" size={16} />}>Add shift</Button>
      </Row>
      <div style={{ maxWidth: 360 }}>
        <Button fullWidth size="lg">
          Log in
        </Button>
      </div>
    </Section>
  );
}

function FormsSection() {
  const [checked, setChecked] = useState(true);
  const [smsOn, setSmsOn] = useState(true);
  const [position, setPosition] = useState("");
  const [note, setNote] = useState("");
  return (
    <Section title="Form fields">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-5)",
          maxWidth: 800,
        }}
      >
        <Input label="Phone or email" placeholder="maria@example.com" />
        <Input
          label="Password"
          type="password"
          error="Enter at least 8 characters"
        />
        <Input label="Disabled" disabled placeholder="Not editable" />
        <Input
          label="With icon"
          icon={<Icon name="clock" size={16} />}
          placeholder="7:00 AM"
        />
        <Select
          label="Position"
          placeholder="Choose a position"
          options={POSITIONS}
          value={position}
          onChange={setPosition}
        />
        <Textarea
          label="Shift notes"
          placeholder="Bring your own knife kit."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Row>
        <Checkbox
          label="Line cook"
          checked={checked}
          onChange={setChecked}
        />
        <Checkbox label="Disabled" disabled />
        <Switch
          label="Text message alerts"
          checked={smsOn}
          onChange={setSmsOn}
        />
        <Switch label="Disabled" disabled />
      </Row>
    </Section>
  );
}

function TimeFieldSection() {
  const [start, setStart] = useState("");
  return (
    <Section title="Time field">
      <div style={{ maxWidth: 280 }}>
        <TimeField label="Start time" value={start} onChange={setStart} />
      </div>
      <p style={{ fontSize: "var(--text-body-sm-size)", color: "var(--text-secondary)" }}>
        Try &quot;7:00 AM&quot; (valid) and &quot;25:00&quot; (invalid, error
        appears after you leave the field).
      </p>
    </Section>
  );
}

function FeedbackSection() {
  return (
    <Section title="Badges, tags, tooltip">
      <Row>
        <Badge tone="success">Confirmed</Badge>
        <Badge tone="warning">Pending</Badge>
        <Badge tone="danger">Conflict</Badge>
        <Badge tone="info">Draft</Badge>
        <Badge tone="neutral">Off</Badge>
      </Row>
      <Row>
        <Tag>Line cook</Tag>
        <Tag color="brand">Server</Tag>
        <Tag color="accent">Host</Tag>
        <Tag onRemove={() => {}}>Removable</Tag>
      </Row>
      <Row>
        <Tooltip label="Add shift">
          <Button variant="secondary" size="sm" aria-label="Add shift">
            <Icon name="plus" size={16} />
          </Button>
        </Tooltip>
        <Tooltip label="Shown below" side="bottom">
          <Button variant="ghost" size="sm">
            Hover or focus me
          </Button>
        </Tooltip>
      </Row>
    </Section>
  );
}

function ToastSection() {
  const { toast } = useToast();
  return (
    <Section title="Toasts">
      <Row>
        <Toast
          tone="success"
          title="Schedule published"
          description="12 employees notified."
        />
        <Toast
          tone="warning"
          title="Shift unassigned"
          description="Saturday 4:00 PM – 10:00 PM has no server."
        />
      </Row>
      <Row>
        <Toast
          tone="danger"
          title="Could not save shift"
          description="This shift overlaps with Maria's 2:00 PM – 6:00 PM shift."
          onClose={() => {}}
        />
        <Toast
          tone="info"
          title="Reminder"
          description="Your Line cook shift starts at 7:00 AM tomorrow."
        />
      </Row>
      <Row>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              title: "Schedule published",
              description: "12 employees notified.",
              tone: "success",
            })
          }
        >
          Fire success toast
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              title: "Could not save shift",
              description:
                "This shift overlaps with Maria's 2:00 PM – 6:00 PM shift.",
              tone: "danger",
            })
          }
        >
          Fire danger toast
        </Button>
      </Row>
    </Section>
  );
}

function DialogSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <Section title="Dialog and sheet">
      <Row>
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open sheet
        </Button>
      </Row>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Publish schedule"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Publish</Button>
          </>
        }
      >
        This will notify 12 employees about their shifts for Jul 6 – Jul 12.
      </Dialog>
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Request swap"
        footer={
          <Button fullWidth onClick={() => setSheetOpen(false)}>
            Send request
          </Button>
        }
      >
        Anyone qualified can pick up this shift once your manager approves.
      </Sheet>
    </Section>
  );
}

function TabsSection() {
  const [view, setView] = useState("week");
  return (
    <Section title="Tabs">
      <Tabs
        tabs={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
        value={view}
        onChange={setView}
      />
    </Section>
  );
}

function SchedulingSection() {
  return (
    <Section title="Scheduling">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
          gap: "var(--space-4)",
          maxWidth: 760,
        }}
      >
        <ShiftBlock
          role="Line cook"
          time="7:00 AM – 3:00 PM"
          employeeName="Maria Garcia"
          status="confirmed"
          onClick={() => {}}
        />
        <ShiftBlock role="Server" time="4:00 PM – 10:00 PM" status="open" />
        <ShiftBlock
          role="Server"
          time="2:00 PM – 6:00 PM"
          employeeName="Sam Torres"
          status="conflict"
          conflictReason="Overlaps with Sam's 4:00 PM – 10:00 PM shift"
        />
        <ShiftBlock
          role="Dishwasher"
          time="6:00 PM – 12:00 AM"
          employeeName="Alex Kim"
          status="draft"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 160px)",
          gap: "var(--space-4)",
        }}
      >
        <WeekGridCell empty onClick={() => {}} />
        <WeekGridCell>
          <ShiftBlock
            role="Host"
            time="11:00 AM – 5:00 PM"
            employeeName="Priya Shah"
            compact
          />
        </WeekGridCell>
        <WeekGridCell hasConflict>
          <ShiftBlock
            role="Server"
            time="2:00 PM – 6:00 PM"
            employeeName="Sam Torres"
            status="conflict"
            compact
            conflictReason="Double-booked"
          />
        </WeekGridCell>
      </div>
      <Row>
        <AvatarStatus name="Maria Garcia" status="available" />
        <AvatarStatus name="Sam Torres" status="unavailable" />
        <AvatarStatus name="Priya Shah" status="pending" />
        <AvatarStatus name="Alex Kim" status="off" />
        <Avatar name="Jamie Park" />
        <ConflictChip>
          This shift overlaps with Maria&apos;s 2:00 PM – 6:00 PM shift
        </ConflictChip>
      </Row>
    </Section>
  );
}

function StatesSection() {
  return (
    <Section title="Loading, empty, and stat blocks">
      <Row>
        <Spinner />
        <Spinner size={32} label="Publishing schedule…" />
      </Row>
      <Card padding="0" style={{ maxWidth: 420 }}>
        <EmptyState
          title="No shifts this week"
          description="Add a shift to get started."
          action={
            <Button size="sm" icon={<Icon name="plus" size={14} />}>
              Add shift
            </Button>
          }
        />
      </Card>
      <div style={{ display: "flex", gap: "var(--space-4)", maxWidth: 760 }}>
        <StatCard
          label="Coverage gaps this week"
          value="2"
          tone="var(--status-warning)"
        />
        <StatCard label="Pending requests" value="3" />
        <StatCard
          label="Clocked in now"
          value="4"
          tone="var(--status-success)"
        />
      </div>
    </Section>
  );
}

function ChromeSection() {
  return (
    <Section title="Chrome">
      <p style={{ fontSize: "var(--text-body-sm-size)", color: "var(--text-secondary)" }}>
        Links point at real routes that later phases build; a 404 on click is
        expected for now.
      </p>
      <div
        style={{
          height: 480,
          width: 232,
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <ManagerSidebar locationName="Downtown" userName="Jamie Park" />
      </div>
      <div
        style={{
          width: 390,
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <EmployeeTopBar
          title="Hi, Maria"
          action={
            <Button variant="ghost" size="sm" aria-label="Notifications">
              <Icon name="bell" size={20} />
            </Button>
          }
        />
        <EmployeeTopBar title="Shift detail" backHref="/design-system" />
        <EmployeeTabBar />
      </div>
      <DatePager
        label="Jul 6 – Jul 12"
        prevHref="/design-system?week=prev"
        nextHref="/design-system?week=next"
        todayHref="/design-system"
        prevLabel="Previous week"
        nextLabel="Next week"
      />
    </Section>
  );
}

export default function DesignSystemPage() {
  return (
    <ToasterProvider>
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "var(--space-8) var(--space-6) var(--space-12)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-10)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-h1-size)",
              fontWeight: "var(--text-h1-weight)",
            }}
          >
            Design system
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Every primitive in every state. This page is the manual QA surface
            for Phase 1.
          </p>
        </div>
        <ButtonsSection />
        <FormsSection />
        <TimeFieldSection />
        <FeedbackSection />
        <ToastSection />
        <DialogSection />
        <TabsSection />
        <SchedulingSection />
        <StatesSection />
        <ChromeSection />
      </main>
    </ToasterProvider>
  );
}
