import type { ReactNode } from "react";

import { IconBackLink } from "@/components/IconBackLink";

type HotelManagementWorkspaceProps = {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  topSlot?: ReactNode;
  formSlot: ReactNode;
  roomsSlot?: ReactNode;
  ratesSlot?: ReactNode;
  availabilitySlot?: ReactNode;
  footerSlot?: ReactNode;
};

export function HotelManagementWorkspace({
  backHref,
  backLabel,
  title,
  description,
  topSlot,
  formSlot,
  roomsSlot,
  ratesSlot,
  availabilitySlot,
  footerSlot,
}: HotelManagementWorkspaceProps) {
  return (
    <section className="section admin-section">
      <IconBackLink href={backHref} ariaLabel={backLabel} />

      <div className="section-heading admin-section-heading">
        <h1>{title}</h1>
        {description ? <p className="admin-rooms-copy">{description}</p> : null}
      </div>

      {topSlot}
      {formSlot}
      {roomsSlot}
      {ratesSlot}
      {availabilitySlot}
      {footerSlot}
    </section>
  );
}
