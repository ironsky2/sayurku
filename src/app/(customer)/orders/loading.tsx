// Orders page loading — header shimmer + 4 list item shimmers
export default function Loading() {
  return (
    <div className="fade-in px-4 py-5 space-y-4">
      {/* Page header shimmer */}
      <div className="h-7 w-28 rounded-lg shimmer" />

      {/* 4 order list items */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl shimmer" />
      ))}
    </div>
  )
}
