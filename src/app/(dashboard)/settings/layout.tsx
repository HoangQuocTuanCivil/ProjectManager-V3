"use client";

/**
 * Settings layout — renders settings pages directly without a sub-sidebar.
 * Navigation between settings sections is handled via the topbar account dropdown menu.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  );
}
