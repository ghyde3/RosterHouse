import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
      <Spinner />
    </div>
  );
}
