/**
 * Document-style shell for pages without the sidebar (fabric passport, buyer tracking, scanner, sign in):
 * the LoomSense wordmark on top, then centred content up to max-w-2xl. Works at 390px wide.
 */
export default function PublicPage({ children, action }) {
  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-semibold text-gray-900">LoomSense</span>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}
