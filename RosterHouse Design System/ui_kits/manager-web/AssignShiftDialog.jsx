(function () {
const { Dialog, Select, Input, Button, ConflictChip } = window.RosterHouseDesignSystem_17c92d;

const EMPLOYEES = ["Maria Garcia", "Sam Torres", "Jordan Park", "Alex Kim", "Priya Shah", "Diego Ramirez", "Chloe Nguyen", "Marcus Bell", "Taylor Osei", "Grace Lin"];

function AssignShiftDialog({ open, role, day, existing, onClose, onSave, onDelete }) {
  const [employee, setEmployee] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setEmployee(existing ? existing.employeeName || "" : "");
      setStart(existing ? existing.time.split(" – ")[0] : "");
      setEnd(existing ? existing.time.split(" – ")[1] : "");
    }
  }, [open, existing]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? "Edit shift" : "Assign shift"}
      footer={
        <>
          {existing && (
            <Button variant="ghost" onClick={onDelete}>
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave({ employeeName: employee, time: `${start} – ${end}` })}
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {role} · {day}
        </div>
        {existing && existing.status === "conflict" && existing.conflictReason && (
          <ConflictChip>{existing.conflictReason}</ConflictChip>
        )}
        <Select
          label="Employee"
          value={employee}
          onChange={setEmployee}
          placeholder="Open shift (unassigned)"
          options={EMPLOYEES.map((e) => ({ value: e, label: e }))}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input label="Start" placeholder="7:00 AM" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <Input label="End" placeholder="3:00 PM" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

window.__rhManagerAssignDialog = { AssignShiftDialog };

})();
