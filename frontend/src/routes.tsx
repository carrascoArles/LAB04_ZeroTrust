import type { RouteObject } from "react-router";
import { Layout } from "./components/Layout";
import { AuditPage } from "./pages/AuditPage";
import { CallbackPage } from "./pages/CallbackPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ManageProjectsPage } from "./pages/ManageProjectsPage";
import { MyDonationsPage } from "./pages/MyDonationsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

/** Rutas de la SPA (plan.md). CloudFront devuelve index.html para cualquier ruta. */
export const routes: RouteObject[] = [
  {
    path: "/",
    Component: Layout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: CatalogPage },
      { path: "proyectos/:projectId", Component: ProjectDetailPage },
      { path: "mis-donaciones", Component: MyDonationsPage },
      { path: "gestion", Component: ManageProjectsPage },
      { path: "auditoria", Component: AuditPage },
      { path: "callback", Component: CallbackPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
];
