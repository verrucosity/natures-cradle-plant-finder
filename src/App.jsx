import { useState } from 'react';
import { WishlistProvider } from './context/WishlistContext';
import AdminPage from './pages/AdminPage';
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
          <PlantGrid
            plants={paginated}
            sort={sort}
            onSort={handleSort}
            activeFilters={active}
            onRemoveFilter={removeFilter}
            onOpen={setModalPlant}
          />
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </div>

      {modalPlant && (
        <PlantModal plant={modalPlant} onClose={() => setModalPlant(null)} />
      )}

      <WishlistDrawer />
    </>
  );
}

export default function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPage />;
  }

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
