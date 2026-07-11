"use client";

import { useEffect } from "react";

// Design-decision helper: ?theme=paper or ?theme=modern anywhere in the app
// previews a candidate theme (persisted for the session so navigation keeps
// it). No param and no stored choice = the default theme. Remove this
// component once the design is locked.
export default function ThemeParam() {
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("theme");
    if (param === "default") {
      sessionStorage.removeItem("trove-theme");
      delete document.documentElement.dataset.theme;
      return;
    }
    const theme = param || sessionStorage.getItem("trove-theme");
    if (theme === "paper" || theme === "modern") {
      sessionStorage.setItem("trove-theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  }, []);

  return null;
}
