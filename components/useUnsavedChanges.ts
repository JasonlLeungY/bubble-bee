"use client";

import { useEffect, type RefObject } from "react";

/**
 * Warns before the page is closed or reloaded while a form has unsaved changes.
 * Submitting the form clears the warning. Moving between pages inside the app
 * is not covered.
 */
export function useUnsavedChanges(formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let dirty = false;
    const mark = () => {
      dirty = true;
    };
    const clear = () => {
      dirty = false;
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    form.addEventListener("input", mark);
    form.addEventListener("change", mark);
    form.addEventListener("submit", clear);
    window.addEventListener("beforeunload", warn);
    return () => {
      form.removeEventListener("input", mark);
      form.removeEventListener("change", mark);
      form.removeEventListener("submit", clear);
      window.removeEventListener("beforeunload", warn);
    };
  }, [formRef]);
}
