import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DocsSidebar } from "@/components/docs/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
        <div className="flex gap-10 py-10 lg:py-14">
          <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] w-56 shrink-0 overflow-y-auto lg:block">
            <DocsSidebar />
          </aside>
          <article className="min-w-0 max-w-2xl flex-1">{children}</article>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
