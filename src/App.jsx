import { useState } from 'react';
import { WishlistProvider } from './context/WishlistContext';
import Header from './components/Header';
import Hero from './components/Hero';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import PlantGrid from './components/PlantGrid';
import Pagination from './components/Pagination';
import PlantModal from './components/PlantModal';
import WishlistDrawer from './components/WishlistDrawer';
import usePlants from './hooks/usePlants';
import './App.css';

function AppInner() {
  const {
    query, handleQuery,
    active, toggleFilter, removeFilter, clearAll,
    sort, handleSort,
    page, setPage,
    paginated, filtered,
    totalPages,
    options,
    totalCount,
  } = usePlants();

  const [modalPlant, setModalPlant] = useState(null);

  return (
    <>
      <Header />
      <Hero totalCount={totalCount} />
      <SearchBar
        query={query}
        onQuery={handleQuery}
        resultCount={filtered.length}
        onClear={clearAll}
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
  return (
    <WishlistProvider>
      <AppInner />
    </WishlistProvider>
  );
}
