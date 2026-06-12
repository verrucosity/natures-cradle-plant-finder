import { useState, lazy, Suspense } from 'react';
import { WishlistProvider } from './context/WishlistContext';

// Lazy-load admin so customers never download the PDF-parsing code
const AdminPage = lazy(() => import('./pages/AdminPage'));
import Header from './components/Header';
import Footer from './components/Footer';
import Hero from './components/Hero';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import PlantGrid from './components/PlantGrid';
import Pagination from './components/Pagination';
import PlantModal from './components/PlantModal';
import WishlistDrawer from './components/WishlistDrawer';
import ZipGate, { getSavedZip, saveZip } from './components/ZipGate';
import usePlants from './hooks/usePlants';
import './App.css';

function AppInner({ customerZip, onChangeZip }) {
  // Returning visitors get a slimmer hero — they've seen the pitch
  const [isReturning] = useState(() => {
    const seen = localStorage.getItem('nc_visited') === '1';
    localStorage.setItem('nc_visited', '1');
    return seen;
  });

  const {
    query, handleQuery,
    active, toggleFilter, removeFilter, clearAll,
    sort, handleSort,
    page, setPage,
    paginated, filtered,
    totalPages,
    options,
    totalCount,
    loading,
    inStockOnly, toggleInStock,
  } = usePlants(customerZip);

  const [modalPlant, setModalPlant] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = Object.values(active).reduce((n, arr) => n + arr.length, 0);

  return (
    <>
      <Header customerZip={customerZip} onChangeZip={onChangeZip} />
      <Hero totalCount={totalCount} compact={isReturning} />
      <SearchBar
        query={query}
        onQuery={handleQuery}
        resultCount={filtered.length}
        onClear={clearAll}
        customerZip={customerZip}
      />

      <div className="layout">
        <Sidebar
          options={options}
          active={active}
          onToggle={toggleFilter}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />
        <div className="layout-right">
          {loading && (
            <div className="grid skeleton-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img" />
                  <div className="skeleton-line w70" />
                  <div className="skeleton-line w90" />
                  <div className="skeleton-line w50" />
                </div>
              ))}
            </div>
          )}
          {!loading && <PlantGrid
            plants={paginated}
            sort={sort}
            onSort={handleSort}
            activeFilters={active}
            onRemoveFilter={removeFilter}
            onOpen={setModalPlant}
            inStockOnly={inStockOnly}
            onToggleInStock={toggleInStock}
          />}
          {!loading && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </div>
      </div>

      {/* Mobile filter button */}
      <button className="filters-fab" onClick={() => setFiltersOpen(true)}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
        </svg>
        Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
      </button>

      {modalPlant && (
        <PlantModal plant={modalPlant} onClose={() => setModalPlant(null)} />
      )}

      <WishlistDrawer />
      <Footer />
    </>
  );
}

// Route check at module level — the path never changes during a mount, and
// keeping it out of the component avoids calling hooks conditionally.
const IS_ADMIN = window.location.pathname === '/admin';

export default function App() {
  if (IS_ADMIN) {
    return (
      <Suspense fallback={<div style={{ padding: 60, textAlign: 'center' }}>Loading admin…</div>}>
        <AdminPage />
      </Suspense>
    );
  }
  return <CustomerApp />;
}

function CustomerApp() {
  // Check if customer has already set their zip
  const [customerZip, setCustomerZip] = useState(() => getSavedZip());
  const [zipConfirmed, setZipConfirmed] = useState(() => localStorage.getItem('nc_zip_confirmed') === '1');

  function handleZip(zip) {
    saveZip(zip);
    setCustomerZip(zip);
    setZipConfirmed(true);
    localStorage.setItem('nc_zip_confirmed', '1');
  }

  function handleChangeZip() {
    localStorage.removeItem('nc_zip_confirmed');
    localStorage.removeItem('nc_customer_zip');
    setCustomerZip('');
    setZipConfirmed(false);
  }

  return (
    <WishlistProvider>
      {!zipConfirmed && <ZipGate onZip={handleZip} />}
      <AppInner customerZip={customerZip} onChangeZip={handleChangeZip} />
    </WishlistProvider>
  );
}
