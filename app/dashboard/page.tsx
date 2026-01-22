function matchesFamily(tags: string[], family: string) {
  const t = Array.isArray(tags) ? tags : [];

  const isTele = t.includes("FAM_TELE") || t.includes("TELESURVEILLANCE") || t.includes("GARDIENNAGE");
  const isFormation = t.includes("FAM_FORMATION") || t.includes("FORMATION");
  const isAudit = t.includes("FAM_AUDIT") || t.includes("AUDIT_SECURITE");

  if (family === "ALL") return true;
  if (family === "TELESURVEILLANCE") return isTele;
  if (family === "FORMATION") return isFormation;
  if (family === "AUDIT") return isAudit;

  if (family === "AUTRES") return !isTele && !isFormation && !isAudit;

  return true;
}
