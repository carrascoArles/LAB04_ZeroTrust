// Los nombres de tabla coinciden con los IDs lógicos de la plantilla, para poder cotejar
// cada operación contra el rol IAM de la función.
process.env.PROJECTS_TABLE = "ProjectsTable";
process.env.DONATIONS_TABLE = "DonationsTable";
process.env.IDEMPOTENCY_TABLE = "IdempotencyTable";
process.env.AUDIT_TABLE = "AuditEventsTable";
process.env.STAGE = "academic";
process.env.AWS_REGION ??= "us-east-2";
