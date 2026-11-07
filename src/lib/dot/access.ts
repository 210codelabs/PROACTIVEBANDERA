export function employerDotExamSummary(exam: Record<string, any>, mecAuthorized = false) {
  return {
    id: exam.id,
    employeeId: exam.employeeId,
    driverName: exam.driverName,
    status: exam.status,
    transmissionStatus: exam.transmissionStatus,
    certificationStatus: exam.mecIssuedAt ? "certificate_issued" : exam.isLocked ? "no_certificate_issued" : "pending",
    expiresOn: mecAuthorized ? exam.expiresOn : null,
    mecDocumentId: mecAuthorized ? exam.employerMecDocId : null,
    kioskToken: exam.status === "completed" ? null : exam.kioskToken,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  };
}