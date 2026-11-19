import { LocaleLink as Link } from "@/modules/i18n/ui";
import type { ReactNode } from "react";

// DESIGN.md, Help Pointer Link: the lowercase label in the interactive green with a 1px dashed
// underline that turns solid on hover. The `-->` that stood before it is gone in every direction
// (issue #236, the user's choice): the dashed underline alone says it is a link.
export function HelpPointer({ href, children }: { href: string; children: ReactNode }) {
  // An absolute href leaves the app, and `Link` has no prefetch or client navigation to offer for it.
  const Tag = href.startsWith("http") ? "a" : Link;
  return (
    <Tag href={href} className="font-mono text-label leading-[normal] no-underline">
      <span className="border-b border-dashed border-current text-link hover:border-solid">{children}</span>
    </Tag>
  );
}
