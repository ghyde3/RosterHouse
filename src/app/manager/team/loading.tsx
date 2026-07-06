import { Spinner } from "@/components/ui/Spinner";

export default function TeamLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
      <Spinner />
    </div>
  );
}
