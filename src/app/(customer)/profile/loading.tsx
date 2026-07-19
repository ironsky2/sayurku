// Profile page loading — avatar shimmer + 4 row shimmers
export default function Loading() {
  return (
    <div className="fade-in px-4 py-5 space-y-4">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-20 h-20 rounded-full shimmer" />
        <div className="h-5 w-32 rounded-lg shimmer" />
        <div className="h-4 w-24 rounded-lg shimmer" />
      </div>

      {/* 4 profile info rows */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 rounded-2xl shimmer" />
      ))}
    </div>
  )
}
