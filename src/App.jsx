import React, { useEffect, useState } from 'react';
import './App.css';
import { continentMap } from './continentMap.js';

function App() {
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "country", direction: 'ascending' });
  const [selectedContinents, setSelectedContinents] = useState([ "Africa", "Asia", "Europe", "North America", "South America", "Oceania" ]);
  const [selectedLevels, setSelectedLevels] = useState([1, 2, 3, 4]);
  const [advisories, setAdvisories] = useState({});
  const [loading, setLoading] = useState(true);
  const [continentDropdownOpen, setContinentDropdownOpen] = useState(false);
  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);

  const PPPURL = "http://localhost:3001/api/price-level";
  const levelURL = "http://localhost:3001/api/advisories";

  useEffect(() => {
    async function fetchPPP() {
      try {
        setLoading(true);
        const response = await fetch(PPPURL);
        const json = await response.json();
        if (!json || !Array.isArray(json) || !Array.isArray(json[1])) {
          console.error("Unexpected World Bank response:", json);
          return;
        }
        const data = json[1];
        const byCountry = {};
        data.forEach(entry => {
          if (!entry || !entry.country || !entry.country.value) return;

          const country = entry.country.value;
          const year = Number(entry.date);
          const value = entry.value;

          if (!byCountry[country]) byCountry[country] = {};
          byCountry[country][year] = value;
        });

        const usSeries = byCountry["United States"];
        if (!usSeries) {
          console.error("US data missing");
          return;
        }

        const table = Object.entries(byCountry).map(([country, series]) => {
          const years = Object.keys(series).map(Number).sort((a, b) => b - a);
          const currentYear = years.find(y => usSeries[y] != null);
          if (!currentYear) {return {country, current: null, change1: null, change5: null}};
          
          const prev1Year = years.find(y => y === currentYear - 1 && usSeries[y] != null);
          const prev5Year = years.find(y => y === currentYear - 5 && usSeries[y] != null);
          
          const current = series[currentYear] ?? null;
          const prev1 = prev1Year ? series[prev1Year] ?? null : null;
          const prev5 = prev5Year ? series[prev5Year] ?? null : null;

          const usCurrent = usSeries[currentYear] ?? null;
          const usPrev1 = prev1Year ? usSeries[prev1Year] ?? null : null;
          const usPrev5 = prev5Year ? usSeries[prev5Year] ?? null : null;

          const relCurrent = current && usCurrent ? current / usCurrent : null;
          const relPrev1 = prev1 && usPrev1 ? prev1 / usPrev1 : null;
          const relPrev5 = prev5 && usPrev5 ? prev5 / usPrev5 : null;

          const change1 = relCurrent && relPrev1 ? ((relCurrent - relPrev1) / relPrev1) * 100 : null;
          const change5 = relCurrent && relPrev5 ? ((relCurrent - relPrev5) / relPrev5) * 100 : null;

          return { country, current: relCurrent, change1, change5, advisory: advisories[country] ?? null };
        });

        setAllRows(table);
        setLoading(false);
      } catch (err) {
        console.error("PPP fetch error:", err);
        setLoading(false);
      }
    }

    fetchPPP();
  }, []);

  useEffect(() => {
    async function fetchAdvisories() {
      try {
        const res = await fetch(levelURL);
        const json = await res.json();
        setAdvisories(json);
      } catch (err) {
        console.error("Travel advisories fetch error:", err);
      }
    }

    fetchAdvisories();
  }, []);

  useEffect(() => {
    const filtered = allRows.filter(r => {
    const continent = continentMap[r.country];
    const level = advisories[r.country];
    return (r.current != null && continent && selectedContinents.includes(continent) && level != null && selectedLevels.includes(level));
  });
    setRows(filtered);
  }, [allRows, selectedContinents, selectedLevels, advisories]);

  function sortBy(key) {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  }

  const sortedRows = [...rows].sort((a, b) => {
    const { key, direction } = sortConfig;
    const valA = a[key];
    const valB = b[key];

    if (valA === null) return 1;
    if (valB === null) return -1;

    if (typeof valA === "string") {
      return direction === "ascending" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    return direction === "ascending" ? valA - valB : valB - valA;
  });

  if (loading) return <p>Fetching PPP data...</p>;
  
  function toggleContinent(continent) {
    setSelectedContinents(prev => prev.includes(continent) ? prev.filter(c => c !== continent) : [...prev, continent]);
  }

  function toggleLevel(level) {
    setSelectedLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
  }

  return (
    <div>
      <h1>Travel Calculator for the US Dollar</h1>
      <h3>Find where the US Dollar goes further by comparing how expensive a country is compared to the US.</h3><hr/>
      <p>The ratio below is the relative price level based on the market exchange rate and local prices.</p>
      <p>A ratio of 0.5 means that things cost half as much in that country compared to the US on average.  A ratio of 2 means things cost twice as much.</p><hr/>
      <div className="section">
        <label><strong>Filter by Continent:</strong></label>
        <button className="btn-small" onClick={() => setContinentDropdownOpen(open => !open)}>Continents</button>
        {continentDropdownOpen && (
          <div className="dropdown">
          {["Africa", "Asia", "Europe", "North America", "South America", "Oceania"].map(continent => (
            <label key={continent}>
            <input 
              type="checkbox"
              checked={selectedContinents.includes(continent)}
              onChange={() => toggleContinent(continent)}
            />
            {continent}
            </label>
          ))}   
        </div>
        )}
      </div>

      <div className="section">
        <label><strong>Filter by Advisory Level:</strong></label>
        <button className="btn-small" onClick={() => setLevelDropdownOpen(open => !open)}>Levels</button>
        {levelDropdownOpen && (
          <div className="dropdown">
          {[1, 2, 3, 4].map(level => (
            <label key={level}>
            <input 
              type="checkbox"
              checked={selectedLevels.includes(level)}
              onChange={() => toggleLevel(level)}
            />
            Level {level}
            </label>
          ))}   
        </div>
        )}
      </div>

      <table className="table">
        <thead>
          <tr>
            <Th label="Country" sortKey="country" sortBy={sortBy} />
            <Th label="Current Ratio" sortKey="current" sortBy={sortBy} />
            <Th label="1-Year Change (%)" sortKey="change1" sortBy={sortBy} />
            <Th label="5-Year Change (%)" sortKey="change5" sortBy={sortBy} />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, i) => (
            <tr key={i}>
              <td>{r.country}</td>
              <td>{r.current != null ? r.current.toFixed(2) : "-"}</td>
              <td>{r.change1 != null ? r.change1.toFixed(2) + "%" : "-"}</td>
              <td>{r.change5 != null ? r.change5.toFixed(2) + "%" : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footer">Data is pulled from the World Bank and US State Department.</p>
    </div>
  );
};

function Th({ label, sortKey, sortBy }) {
  return (
    <th style={{ cursor: "pointer" }} onClick={() => sortBy(sortKey)}>{label}</th>
  );
};

export default App;
