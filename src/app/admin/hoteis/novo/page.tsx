import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";

import { HotelManagementWorkspace } from "../HotelManagementWorkspace";
import { CreateHotelForm } from "./CreateHotelForm";

function LockedSetupSection({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div id={id} className="hotel-content-card admin-form-section">
      <div className="section-heading admin-subsection-heading">
        <h2>{title}</h2>
      </div>
      <div className="admin-editor-banner">
        <strong>Disponível após salvar o rascunho</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default async function NewHotelPage() {
  try {
    await requireAdminRouteSession("/admin/hoteis/novo");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  return (
    <HotelManagementWorkspace
      backHref="/admin"
      backLabel="Voltar ao painel"
      title="Adicionar hotel"
      description="Crie a unidade com a mesma base da edição. Salve o rascunho para liberar quartos, tarifas, disponibilidade e experiências."
      topSlot={
        <section id="hotel-review" className="hotel-content-card admin-approval-card">
          <div className="admin-editor-banner">
            <strong>Fluxo de criação</strong>
            <p>
              Preencha os dados do hotel e salve o rascunho. Depois disso, a edição da unidade
              libera as seções dependentes e o envio para aprovação.
            </p>
          </div>
        </section>
      }
      formSlot={<CreateHotelForm />}
      roomsSlot={
        <LockedSetupSection
          id="hotel-rooms"
          title="Quartos"
          description="Salve os dados básicos para cadastrar quartos na mesma tela de gestão do hotel."
        />
      }
      ratesSlot={
        <LockedSetupSection
          id="hotel-rates"
          title="Tarifas"
          description="Depois do primeiro save, cadastre tarifas ativas para os quartos criados."
        />
      }
      availabilitySlot={
        <LockedSetupSection
          id="hotel-availability"
          title="Disponibilidade"
          description="A disponibilidade fica acessível quando o hotel já existe e possui quartos."
        />
      }
    />
  );
}
