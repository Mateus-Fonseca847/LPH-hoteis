type AdminAccessDeniedProps = {
  title?: string;
  description?: string;
};

export function AdminAccessDenied({
  title = "Acesso negado",
  description = "Você não tem permissão para acessar esta área administrativa.",
}: AdminAccessDeniedProps) {
  return (
    <section className="section admin-section admin-access-denied">
      <div className="section-heading admin-section-heading">
        <h1>{title}</h1>
      </div>
      <p>{description}</p>
    </section>
  );
}
