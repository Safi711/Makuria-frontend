export default function CaseMapperLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row">
      <div className="h-40 w-full shrink-0 animate-pulse rounded-md bg-neutral-100 md:w-56" />
      <div className="flex-1 space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-neutral-100" />
        <div className="h-40 w-full animate-pulse rounded-md bg-neutral-100" />
        <div className="h-24 w-full animate-pulse rounded-md bg-neutral-100" />
      </div>
    </div>
  );
}
