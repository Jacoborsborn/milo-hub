import Link from "next/link";
import TemplatesMealsContent from "./TemplatesMealsContent";

export default function TemplatesMealsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates" className="text-neutral-500 hover:text-neutral-700 text-sm">
          ← Programs
        </Link>
        <span className="text-neutral-400">/</span>
        <h1 className="text-xl font-bold">Meals</h1>
      </div>
      <TemplatesMealsContent />
    </div>
  );
}
