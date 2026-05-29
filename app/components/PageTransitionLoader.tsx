"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import MangaLoader from "./MangaLoader";

function TransitionLoaderEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  // Turn off loading once pathname or search parameters change (navigation completes)
  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams]);

  // Safety timeout to prevent getting stuck in loading state (e.g. on network failures)
  useEffect(() => {
    if (!isLoading) return;

    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      console.warn("[PageTransitionLoader] Loading timed out after 8s safety limit.");
    }, 8000);

    return () => clearTimeout(safetyTimer);
  }, [isLoading]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");
      const downloadAttr = anchor.getAttribute("download");

      // Check if it's explicitly marked to skip loading (e.g. custom action)
      if (anchor.hasAttribute("data-no-transition-loader")) return;

      // We only intercept internal relative links that don't open in a new tab/window and are not downloads
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("/#") &&
        targetAttr !== "_blank" &&
        downloadAttr === null &&
        e.button === 0 && // Left click only
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        try {
          const resolvedUrl = new URL(href, window.location.href);
          const targetPath = resolvedUrl.pathname;
          const currentPath = window.location.pathname;

          // Trigger loader only if actually navigating to a different page path
          if (targetPath !== currentPath) {
            setIsLoading(true);
          }
        } catch (err) {
          console.warn("[PageTransitionLoader] Error parsing click URL:", err);
        }
      }
    };

    const handleNavigation = (url: string | URL | null | undefined) => {
      if (!url) return;
      try {
        const resolvedUrl = new URL(url.toString(), window.location.href);
        const targetPath = resolvedUrl.pathname;
        const currentPath = window.location.pathname;

        if (targetPath !== currentPath) {
          queueMicrotask(() => setIsLoading(true));
        }
      } catch (err) {
        console.warn("[PageTransitionLoader] Error parsing History URL:", err);
      }
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (state, unused, url) {
      handleNavigation(url);
      return originalPushState.apply(this, [state, unused, url]);
    };

    window.history.replaceState = function (state, unused, url) {
      handleNavigation(url);
      return originalReplaceState.apply(this, [state, unused, url]);
    };

    const handlePopState = () => {
      // Show loader on browser back/forward navigation
      queueMicrotask(() => setIsLoading(true));
    };

    document.addEventListener("click", handleAnchorClick);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  if (!isLoading) return null;

  return <MangaLoader fullScreen />;
}

export default function PageTransitionLoader() {
  return (
    <Suspense fallback={null}>
      <TransitionLoaderEvents />
    </Suspense>
  );
}
