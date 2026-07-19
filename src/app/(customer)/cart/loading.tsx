// Cart page loading — header shimmer + 3 item shimmers + summary shimmer
export default function Loading() {
  return (
    <div className="fade-in px-4 py-5 space-y-4">
      {/* Page header shimmer */}
      <div className="h-7 w-20 rounded-lg shimmer" />

      {/* 3 cart item rows */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl shimmer" />
      ))}

      {/* Order summary block */}
      <div className="h-40 rounded-2xl shimmer mt-4" />
    </div>
  )
}
