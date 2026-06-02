import './Pagination.css';

export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const range = [1];
  if (page > 4) range.push('…');
  for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) range.push(i);
  if (page < totalPages - 3) range.push('…');
  if (totalPages > 1) range.push(totalPages);

  const go = target => {
    onPage(target);
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => go(page - 1)} disabled={page === 1}>‹ Prev</button>

      {range.reduce((acc, r, i) => {
        if (r === '…') {
          const prev = acc[acc.length - 1];
          if (prev?.key !== 'ellipsis-' + i) {
            acc.push(<span key={'ellipsis-' + i} className="page-ellipsis">…</span>);
          }
        } else {
          acc.push(
            <button
              key={r}
              className={`page-btn${r === page ? ' active' : ''}`}
              onClick={() => go(r)}
            >
              {r}
            </button>
          );
        }
        return acc;
      }, [])}

      <button className="page-btn" onClick={() => go(page + 1)} disabled={page === totalPages}>Next ›</button>
    </div>
  );
}
