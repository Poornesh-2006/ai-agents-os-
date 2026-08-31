import MemoryPage from "@/components/MemoryPage";

export default function ShortMemoryPage() {
  return (
    <MemoryPage
      title="Short-Term Memory"
      subtitle="Recent run notes, temporary context, current tasks, and active agent memory."
      endpoint="/memory/short-term"
    />
  );
}

