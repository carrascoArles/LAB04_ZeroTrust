import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { ErrorMessage } from "../components/ErrorMessage";
import { TextAreaField, TextField } from "../components/Field";
import { RequireRole } from "../components/RequireRole";
import { StatusBadge } from "../components/StatusBadge";
import { checkAmount, formatCents } from "../domain/money";
import { useCreateProject, usePublishProject } from "../hooks/queries";
import { usePageTitle } from "../hooks/usePageTitle";
import type { Project } from "../services/schemas";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

/** Mismas reglas que CreateProjectRequest; el backend vuelve a validarlas. */
const projectFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribe un título.")
    .max(TITLE_MAX, `Máximo ${TITLE_MAX} caracteres.`),
  description: z
    .string()
    .trim()
    .min(1, "Escribe una descripción.")
    .max(DESCRIPTION_MAX, `Máximo ${DESCRIPTION_MAX} caracteres.`),
  goal: z.string().transform((text, ctx) => {
    const check = checkAmount(text, 1);
    if (!check.ok) {
      ctx.addIssue({ code: "custom", message: check.message });
      return z.NEVER;
    }
    return check.cents;
  }),
});

type ProjectFormInput = z.input<typeof projectFormSchema>;
type ProjectFormOutput = z.output<typeof projectFormSchema>;

function CreateProjectForm({ onCreated }: Readonly<{ onCreated: (project: Project) => void }>) {
  const createProject = useCreateProject();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ProjectFormInput, unknown, ProjectFormOutput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { title: "", description: "", goal: "" },
  });
  const descriptionLength = useWatch({ control, name: "description" }).length;

  const submit = handleSubmit(({ title, description, goal }) =>
    createProject.mutate(
      { title, description, goalAmountCents: goal },
      {
        onSuccess: (project) => {
          onCreated(project);
          reset();
        },
      },
    ),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField
        label="Título"
        required
        maxLength={TITLE_MAX}
        error={errors.title?.message}
        {...register("title")}
      />
      <TextAreaField
        label="Descripción"
        required
        maxLength={DESCRIPTION_MAX}
        hint={`${descriptionLength} de ${DESCRIPTION_MAX} caracteres.`}
        error={errors.description?.message}
        {...register("description")}
      />
      <TextField
        label="Meta en soles (S/)"
        inputMode="decimal"
        autoComplete="off"
        required
        hint="Por ejemplo 5000 o 5000.50, sin separador de miles."
        error={errors.goal?.message}
        {...register("goal")}
      />
      {createProject.isError && <ErrorMessage error={createProject.error} />}
      {createProject.isSuccess && (
        <Alert tone="success" title="Borrador creado">
          <p>«{createProject.data.title}» quedó en BORRADOR. Publícalo en la lista de abajo.</p>
        </Alert>
      )}
      <Button type="submit" busy={createProject.isPending}>
        Crear borrador
      </Button>
    </form>
  );
}

function SessionDrafts({
  drafts,
  onPublished,
}: Readonly<{
  drafts: Project[];
  onPublished: (project: Project) => void;
}>) {
  const publish = usePublishProject();

  if (drafts.length === 0) {
    return <p className="text-slate-700">Todavía no creaste proyectos en esta sesión.</p>;
  }
  return (
    <ul className="space-y-3">
      {drafts.map((project) => {
        const isThis = publish.variables === project.projectId;
        return (
          <li
            key={project.projectId}
            className="space-y-2 rounded-lg border border-slate-300 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold break-words text-slate-900">{project.title}</h3>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-slate-700">
              Meta: {formatCents(project.goalAmountCents)} ·{" "}
              <span className="font-mono text-xs break-all">{project.projectId}</span>
            </p>
            {project.status === "BORRADOR" ? (
              <Button
                onClick={() => publish.mutate(project.projectId, { onSuccess: onPublished })}
                busy={publish.isPending && isThis}
                disabled={publish.isPending}
                aria-label={`Publicar «${project.title}»`}
              >
                Publicar
              </Button>
            ) : (
              <Link
                to={`/proyectos/${project.projectId}`}
                className="inline-flex min-h-11 items-center font-medium text-emerald-800 underline"
              >
                Ver en el catálogo
              </Link>
            )}
            {publish.isError && isThis && <ErrorMessage error={publish.error} />}
          </li>
        );
      })}
    </ul>
  );
}

const publishByIdSchema = z.object({
  projectId: z.string().trim().pipe(z.uuid("Escribe un identificador válido (UUID).")),
});

/** El API no lista borradores: un borrador de otra sesión se publica con su identificador. */
function PublishByIdForm() {
  const publish = usePublishProject();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof publishByIdSchema>, unknown, z.output<typeof publishByIdSchema>>({
    resolver: zodResolver(publishByIdSchema),
    defaultValues: { projectId: "" },
  });

  const submit = handleSubmit(({ projectId }) => publish.mutate(projectId));

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField
        label="Identificador del proyecto"
        autoComplete="off"
        spellCheck={false}
        required
        hint="Lo devuelve el API al crear el borrador."
        error={errors.projectId?.message}
        {...register("projectId")}
      />
      {publish.isError && <ErrorMessage error={publish.error} />}
      {publish.isSuccess && (
        <Alert tone="success" title="Proyecto publicado">
          <p>
            «{publish.data.title}» ya aparece en el{" "}
            <Link to="/" className="underline">
              catálogo
            </Link>
            .
          </p>
        </Alert>
      )}
      <Button type="submit" variant="secondary" busy={publish.isPending}>
        Publicar por identificador
      </Button>
    </form>
  );
}

function ProjectManagement() {
  const [drafts, setDrafts] = useState<Project[]>([]);
  const upsert = (project: Project) =>
    setDrafts((current) => [
      project,
      ...current.filter((item) => item.projectId !== project.projectId),
    ]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section aria-labelledby="crear" className="space-y-4">
        <h2 id="crear" className="text-xl font-semibold text-slate-900">
          Crear proyecto
        </h2>
        <CreateProjectForm onCreated={upsert} />
      </section>
      <div className="space-y-8">
        <section aria-labelledby="borradores" className="space-y-4">
          <h2 id="borradores" className="text-xl font-semibold text-slate-900">
            Proyectos de esta sesión
          </h2>
          <SessionDrafts drafts={drafts} onPublished={upsert} />
        </section>
        <section aria-labelledby="por-id" className="space-y-4">
          <h2 id="por-id" className="text-xl font-semibold text-slate-900">
            Publicar otro borrador
          </h2>
          <PublishByIdForm />
        </section>
      </div>
    </div>
  );
}

/** Gestión de proyectos (HU-08): crear en BORRADOR y publicar. Solo GESTOR. */
export function ManageProjectsPage() {
  usePageTitle("Gestión de proyectos");
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Gestión de proyectos</h1>
        <p className="text-slate-700">
          Un proyecto nace en BORRADOR y solo aparece en el catálogo cuando lo publicas.
        </p>
      </div>
      <RequireRole role="GESTOR">
        <ProjectManagement />
      </RequireRole>
    </>
  );
}
