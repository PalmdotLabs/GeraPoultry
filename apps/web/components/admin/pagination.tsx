'use client';

interface PaginationProps {
  label: string;
  page: number;
  perPage: number;
  total: number;
  busy: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({
  label,
  page,
  perPage,
  total,
  busy,
  onPageChange,
}: PaginationProps) {
  if (total === 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <nav className="admin-pagination" aria-label={label}>
      <p aria-live="polite">
        Showing {first}–{last} of {total}. Page {page} of {pageCount}.
      </p>
      <div>
        <button
          className="button button-secondary"
          type="button"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={busy || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
