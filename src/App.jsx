import { useState, lazy, Suspense } from 'react';
import { WishlistProvider } from './context/WishlistContext';

// Lazy-load admin so customers never download the PDF-parsing code
const AdminPage = lazy(() => import('./pages/AdminPage'));
import Header from './components/Header';
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
  } = usePlants(customerZip);

  const [modalPlant, setModalPlant] = useState(null);

  return (
    <>
      <Header customerZip={customerZip} onChangeZip={onChangeZip} />
      <Hero totalCount={totalCount} />
      <SearchBar
        query={query}
        onQuery={handleQuery}
        resultCount={filtered.length}
        onClear={clearAll}
        customerZip={customerZip}
      />

      <div className="layout">
        <Sidebar options={options} active={active} onToggle={toggleFilter} />
        <div className="layout-right">
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-light, #888)' }}>
              Loading plants…
            </div>
          )}
          {!loading && <PlantGrid
            plants={paginated}
            sort={sort}
            onSort={handleSort}
            activeFilters={active}
            onRemoveFilter={removeFilter}
            onOpen={setModalPlant}
          />}
          {!loading && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </div>
      </div>

      {modalPlant && (
        <PlantModal plant={modalPlant} onClose={() => setModalPlant(null)} />
      )}

      <WishlistDrawer />
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
