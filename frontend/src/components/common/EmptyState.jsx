/** One sentence saying what is missing and how to add it. */
export default function EmptyState({ children }) {
  return (
    <p className="rounded-md border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-600">
      {children}
    </p>
  );
}
