import { ImageResponse } from "next/og";

export const alt = "LPH Hotéis - hospedagens e experiências pelo Brasil";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#f8f5ef",
        color: "#06294f",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        width: "100%",
      }}
    >
      <div
        style={{
          border: "2px solid rgba(6, 41, 79, 0.12)",
          borderRadius: "42px",
          display: "flex",
          flexDirection: "column",
          gap: "30px",
          height: "100%",
          justifyContent: "center",
          padding: "70px",
          width: "100%",
        }}
      >
        <div style={{ color: "#c2a257", display: "flex", fontSize: 28, fontWeight: 700 }}>
          LPH HOTÉIS
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.12 }}>
          Hospedagens e experiências pelo Brasil
        </div>
        <div style={{ color: "#415367", display: "flex", fontSize: 29 }}>
          Curadoria premium para descobrir e consultar sua próxima estadia.
        </div>
      </div>
    </div>,
    size
  );
}
