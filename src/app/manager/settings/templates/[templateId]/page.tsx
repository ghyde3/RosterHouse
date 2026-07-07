import { notFound } from "next/navigation";
import TemplateEditor from "@/components/schedule/TemplateEditor";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getAssignableEmployees } from "@/lib/schedule-data";
import { getTemplateDetail } from "@/lib/template-data";

export default async function TemplateEditorPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const [template, positions, employees] = await Promise.all([
    getTemplateDetail(location.id, templateId),
    prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } }),
    getAssignableEmployees(location.id),
  ]);
  if (!template) notFound();
  return (
    <TemplateEditor
      template={template}
      positions={positions.map((p) => ({ id: p.id, name: p.name }))}
      employees={employees}
    />
  );
}
