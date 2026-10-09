export default function Loading() {
  return (
    <>
      <div className="h-[69px] w-full border-b border-line" />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-6 pb-16 pt-11 sm:px-12">
        <div className="h-[58px] w-48 animate-pulse rounded-xl bg-surface" />
        <div className="h-[140px] animate-pulse rounded-xl bg-surface" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[364px] animate-pulse rounded-[14px] bg-surface" />
          ))}
        </div>
      </div>
    </>
  );
}
