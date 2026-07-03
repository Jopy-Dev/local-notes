/*
 * <Skeleton> per Design_System.md 9.1: matches final geometry, aria-hidden;
 * the container announces busy state. Pulse uses opacity only (motion 7).
 */
export function NoteListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="border-b border-border-subtle px-3 pt-3 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-1/2 rounded-sm bg-surface-raised" />
            <span className="ml-auto h-2 w-8 rounded-sm bg-surface-raised" />
          </div>
          <span className="mt-2 block h-2 w-11/12 rounded-sm bg-surface-raised" />
          <span className="mt-1.5 block h-2 w-2/3 rounded-sm bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}
