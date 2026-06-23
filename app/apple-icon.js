import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1A2B4A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "36px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "2px",
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1,
              fontFamily: "sans-serif",
            }}
          >
            M
          </span>
          <span
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: "#0D7377",
              lineHeight: 1,
              fontFamily: "sans-serif",
            }}
          >
            P
          </span>
        </div>
        <span
          style={{
            fontSize: 16,
            color: "#94a3b8",
            fontFamily: "sans-serif",
            letterSpacing: "3px",
            marginTop: "4px",
          }}
        >
          RE
        </span>
      </div>
    ),
    { ...size }
  );
}
