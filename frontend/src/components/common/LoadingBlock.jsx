/** Short plain line on a gray block, for example <LoadingBlock label="Loading orders" />. */
export default function LoadingBlock({ label = "Loading", height = "h-24" }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-sm text-gray-600 ${height}`}
    >
      {label}
    </div>
  );
}
