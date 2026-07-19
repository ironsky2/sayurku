// Products page loading — header shimmer + 2-col grid of 6 cards
export default function Loading() {
  return (
    <div className="fade-in px-4 py-5 space-y-4">
      {/* Page header shimmer */}
      <div className="space-y-2">
        <div className="h-7 w-36 rounded-lg shimmer" />
        <div className="h-10 rounded-2xl shimmer" />
      </div>

      {/* 2-col product card grid */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-52 rounded-2xl shimmer" />
        ))}
      </div>
    </div>
  )
}
