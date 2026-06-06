import type { AuthorizedHotelRoom } from "./room-actions";

type RateRoomOption = Pick<AuthorizedHotelRoom, "id" | "name">;

export function getInitialRateRoomId(rooms: RateRoomOption[]) {
  return rooms[0]?.id ? String(rooms[0].id) : "";
}

export function getSelectedRateRoom(rooms: RateRoomOption[], selectedRoomId: string) {
  return rooms.find((room) => String(room.id) === selectedRoomId) ?? null;
}

export function getCreateRateDisabledReason({
  canEdit,
  isPending,
  hasRooms,
  selectedRoom,
}: {
  canEdit: boolean;
  isPending: boolean;
  hasRooms: boolean;
  selectedRoom: RateRoomOption | null;
}) {
  if (!canEdit) {
    return "Você não tem permissão para editar este hotel.";
  }

  if (isPending) {
    return "Aguarde a ação atual terminar.";
  }

  if (!hasRooms || !selectedRoom) {
    return "Selecione um quarto para criar tarifa.";
  }

  return "";
}
