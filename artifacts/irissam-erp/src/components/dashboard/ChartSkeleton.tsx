/**
 * Compact skeleton placeholder shown while a chart chunk is loading.
 * Matches the card wrapper used by ChartConsultations / ChartAdmissions /
 * ChartServices so the layout doesn't shift when the real chart arrives.
 */
export function ChartSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col h-full animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-3.5 bg-gray-100 rounded w-32" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
      {/* Legend row */}
      <div className="flex items-center gap-4 mb-4">
        <div className="h-2.5 bg-gray-100 rounded w-20" />
        <div className="h-2.5 bg-gray-100 rounded w-20" />
      </div>
      {/* Chart area */}
      <div className="flex-1 min-h-[160px] bg-gray-50 rounded-md" />
    </div>
  );
}

/** Skeleton for the MiniWidgets row (6 cards). */
export function MiniWidgetsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 h-[130px] animate-pulse flex flex-col gap-2"
        >
          <div className="h-3 bg-gray-100 rounded w-20" />
          <div className="flex gap-2 mt-1">
            <div className="w-8 h-8 bg-gray-100 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5 justify-center">
              <div className="h-2 bg-gray-100 rounded w-full" />
              <div className="h-2 bg-gray-100 rounded w-5/6" />
              <div className="h-2 bg-gray-100 rounded w-4/6" />
              <div className="h-2 bg-gray-100 rounded w-3/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
