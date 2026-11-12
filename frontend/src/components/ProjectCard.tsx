import { Link } from "react-router";
import type { Project } from "../services/schemas";
import { FundingProgress } from "./FundingProgress";

export function ProjectCard({ project }: Readonly<{ project: Project }>) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        <Link to={`/proyectos/${project.projectId}`} className="underline-offset-4 hover:underline">
          {project.title}
        </Link>
      </h2>
      <p className="line-clamp-3 text-slate-700">{project.description}</p>
      <div className="mt-auto">
        <FundingProgress
          confirmedCents={project.confirmedAmountCents}
          goalCents={project.goalAmountCents}
        />
      </div>
    </article>
  );
}
