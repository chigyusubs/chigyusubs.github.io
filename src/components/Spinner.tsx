import React from "react";
import { useTheme } from "../lib/themeContext";

export function Spinner() {
  const theme = useTheme();
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "12px",
        height: "12px",
        marginRight: "6px",
        border: `2px solid ${theme.spinnerTrack}`,
        borderTopColor: theme.spinnerLead,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        verticalAlign: "middle",
      }}
    />
  );
}
