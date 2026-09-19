export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <div className="h-24 animate-pulse rounded-xl bg-surface" />
      <div className="h-20 animate-pulse rounded-xl bg-surface" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
