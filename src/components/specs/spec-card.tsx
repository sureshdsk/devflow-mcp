import Link from "next/link";

interface ArtifactStatus {
  id: string;
  state: "blocked" | "ready" | "in_review" | "done";
}

interface SpecCardProps {
  name: string;
  title: string;
  statuses: ArtifactStatus[];
  createdAt: string;
}

const DOT_COLORS: Record<string, string> = {
  blocked: "bg-gray-300",
  ready: "bg-blue-400",
  in_review: "bg-yellow-400",
  done: "bg-green-500",
};

export function SpecCard({ name, title, statuses, createdAt }: SpecCardProps) {
  return (
    <Link href={`/specs/${name}`}>
      <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer">
        <h3 className="font-black text-lg uppercase">{title || name}</h3>
        <p className="text-sm text-gray-500 font-mono mt-1">{name}</p>

        <div className="flex gap-2 mt-3">
          {statuses.map((s) => (
            <div
              key={s.id}
              className={`w-3 h-3 rounded-full border-2 border-black ${DOT_COLORS[s.state]}`}
              title={`${s.id}: ${s.state}`}
            />
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}
