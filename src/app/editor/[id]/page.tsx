"use client";

import { useParams } from "next/navigation";
import { Editor } from "@/components/editor/editor";

export default function EditorSessionPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  if (!id) return null;
  return <Editor projectId={id} />;
}
