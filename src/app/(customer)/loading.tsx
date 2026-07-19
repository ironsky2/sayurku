// Root customer loading — hero + category row + 6 grid cards
export default function Loading() {
  return (
    <div className="fade-in px-4 py-5 space-y-6">
      {/* Hero shimmer */}
      <div className="h-44 rounded-2xl shimmer" />

      {/* Category row */}
      <div className="space-y-2">
        <div className="h-5 w-32 rounded-lg shimmer" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 w-16 rounded-2xl shrink-0 shimmer" />
          ))}
        </div>
      </div>

      {/* 6 product cards in 2-col grid */}
      <div className="space-y-2">
        <div className="h-5 w-40 rounded-lg shimmer" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 rounded-2xl shimmer" />
          ))}
        </div>
      </div>
    </div>
  )
}
